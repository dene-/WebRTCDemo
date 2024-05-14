<script lang="ts">
	import { page } from '$app/stores';
	import { writable } from 'svelte/store';
	import { onMount } from 'svelte';
	import { v4 as uuid } from 'uuid';
	import dayjs from 'dayjs';
	import Swal from 'sweetalert2';
	import { tick } from 'svelte';

	import MicrophoneButton from '../../components/MicrophoneButton.svelte';
	import VideoButton from '../../components/VideoButton.svelte';

	import { DATA_CHANNEL, MESSAGE_TYPE, iceServers } from './rtcConnection.const';
	import type { RtcConnection, ChatMessage, User } from './rtcConnection.interfaces';

	let roomId = $page.params.roomId;
	let userId: string;
	let username: string;
	let isUsernameInvalid: boolean = false;
	let canEnterRoom = false;
	let canEnterRoomResolve: (value: unknown) => void;

	// Signaling logic
	let socket: WebSocket;
	let rtcConnections: RtcConnection[] = [];
	let chatInput = '';
	let chatMessages = writable<ChatMessage[]>([]);
	let remoteStreams: { [key: string]: { stream: MediaStream } } = {};
	let localStream: MediaStream;

	$: connectedUsers = rtcConnections.filter((conn) => conn.connection.connectionState === 'connected');
	$: disconnectedUsers = rtcConnections.filter((conn) => conn.connection.connectionState !== 'connected');

	function createConnection(user: User, id?: string): RtcConnection {
		const connectionExists = rtcConnections.find((connection) => connection.user.userId === user.userId);

		if (connectionExists) {
			rtcConnections = rtcConnections.filter((connection) => connection.user.userId !== user.userId);
		}

		const rtcConnection = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 });
		const connectionId = id || uuid();

		remoteStreams[connectionId] = { stream: new MediaStream() };

		localStream.getTracks().forEach((track: MediaStreamTrack) => {
			rtcConnection.addTrack(track, localStream);
		});

		rtcConnection.ondatachannel = (event) => {
			const dataChannel = event.channel;

			dataChannel.onmessage = (event) => {
				chatMessages.update((messages) => {
					messages.push(JSON.parse(event.data));
					return messages;
				});
			};
		};

		rtcConnection.onconnectionstatechange = async () => {
			if (rtcConnection.connectionState === 'connected') {
				console.warn(`Connection established with ${user.username} (${user.userId})`);
				rtcConnections = [...rtcConnections];

				await tick();

				const remoteVideo = document.getElementById(`remoteVideo-${user.userId}`) as HTMLVideoElement;
				if (remoteStreams[connection.id].stream.active) {
					remoteVideo.classList.remove('hidden');
				} else {
					remoteVideo.classList.add('hidden');
				}
				remoteVideo.srcObject = remoteStreams[connection.id].stream;
			}
		};

		rtcConnection.ontrack = async (event) => {
			event.streams[0].getTracks().forEach((track: MediaStreamTrack) => {
				remoteStreams[connection.id].stream.addTrack(track);
			});
		};

		rtcConnection.onicecandidate = (event) => {
			if (event.candidate) {
				// console.log(`Received candidate from ${user.username} (${user.userId})`);
				console.log(`Sending candidate to ${user.username} (${user.userId})`);

				socket.send(
					JSON.stringify({
						type: 'candidate',
						receiver: user,
						connectionId: id,
						candidate: event.candidate
					})
				);
			}
		};

		const dataChannel = rtcConnection.createDataChannel(DATA_CHANNEL);

		const connection: RtcConnection = {
			id: connectionId,
			user,
			connection: rtcConnection,
			dataChannel
		};

		rtcConnections = [...rtcConnections, connection];

		return connection;
	}

	function sendChat() {
		const chatMessage: ChatMessage = {
			userId,
			content: chatInput,
			timestamp: Date.now()
		};

		rtcConnections.forEach((connection) => {
			connection.dataChannel.send(JSON.stringify(chatMessage));
		});

		chatMessages.update((messages) => {
			messages.push(chatMessage);
			return messages;
		});

		chatInput = '';
	}

	function changeTheme(e: Event) {
		if ((e.target as HTMLInputElement).checked) {
			document.body.dataset.theme = 'light';
		} else {
			document.body.dataset.theme = 'dark';
		}
	}

	function setLocalVideoStream() {
		if (!localStream) {
			localStream = new MediaStream();
		}

		const localVideo = document.querySelectorAll('.localVideo');

		if (localVideo.length) {
			localVideo.forEach((video) => {
				(video as HTMLVideoElement).srcObject = localStream;
			});
		}
	}

	function verifyUsername() {
		// Regex validate name can only be 30 characters long and must be sanitized
		const usernameRegex = /^[a-zA-Z0-9_]{1,30}$/;
		if (!usernameRegex.test(username)) {
			isUsernameInvalid = true;
			return false;
		}

		localStorage.username = username;

		return true;
	}

	async function enterRoom() {
		if (!verifyUsername()) {
			return;
		}

		canEnterRoom = true;

		canEnterRoomResolve(null);

		await tick();

		setLocalVideoStream();
	}

	onMount(async () => {
		// Get userid from local storage
		userId = localStorage.userId;
		username = localStorage.username;

		if (username === 'undefined') {
			username = '';
		}

		try {
			localStream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { max: 640 },
					height: { max: 480 }
				},
				audio: true
			});
		} catch (err) {
			console.log(err);
			localStream = new MediaStream();
		}

		setLocalVideoStream();

		if (!userId) {
			userId = uuid();
			localStorage.userId = userId;
		}

		await new Promise((resolve) => (canEnterRoomResolve = resolve));

		console.log(`User ID: ${userId}`);

		const user: User = {
			roomId,
			userId,
			username
		};

		socket = new WebSocket('wss://terminaldogma.win/ws');
		socket.onopen = () => {
			console.log('Connected to signaling server');
			socket.send(
				JSON.stringify({
					type: 'connect',
					user
				})
			);
		};

		socket.onmessage = async (event) => {
			const message = JSON.parse(event.data);
			const messageType = message.type;

			if (messageType === MESSAGE_TYPE.connect) {
				const { users } = message as { users: User[] };

				console.log(`Connected to room: ${roomId}`);

				if (users.length) {
					console.log(`Users in room: ${message.users.length}`);

					// Create a new connection for each user
					users.forEach(async (roomUser: User) => {
						const connection = createConnection(roomUser);

						const offer = await connection.connection.createOffer();
						await connection.connection.setLocalDescription(offer);

						// Send offer to room user
						console.log(`Sending offer to ${roomUser.username} (${roomUser.userId})`);

						socket.send(
							JSON.stringify({
								type: 'offer',
								receiver: roomUser,
								sender: user,
								connectionId: connection.id,
								offer
							})
						);
					});
				}
			} else if (messageType === MESSAGE_TYPE.offer) {
				const { sender, receiver } = message as { sender: User; receiver: User };

				console.log(`Received offer from ${sender.username} (${sender.userId})`);

				// Create connection for the sender user of the offer
				const newConnection = createConnection(sender, message.connectionId);

				newConnection.connection.setRemoteDescription(message.offer as RTCSessionDescriptionInit);
				const answer = await newConnection.connection.createAnswer();
				await newConnection.connection.setLocalDescription(answer);

				console.log(`Sending answer to ${sender.username} (${sender.userId})`);

				socket.send(
					JSON.stringify({
						type: 'answer',
						sender: receiver,
						receiver: sender,
						connectionId: message.connectionId,
						answer
					})
				);
			} else if (messageType === MESSAGE_TYPE.answer) {
				const { sender } = message as { sender: User; receiver: User };

				console.log(`Received answer from ${sender.username} (${sender.userId})`);

				const answerConnection = rtcConnections.find((connection) => connection.id === message.connectionId);

				if (answerConnection) {
					await answerConnection.connection.setRemoteDescription(message.answer as RTCSessionDescriptionInit);
				}
			} else if (messageType === MESSAGE_TYPE.candidate) {
				const { sender } = message as { sender: User };

				console.log(`Received candidate from ${sender.username} (${sender.userId})`);

				// Set candidate
				const candidateConnection = rtcConnections.find((connection) => connection.id === message.connectionId);

				if (candidateConnection) {
					await candidateConnection.connection.addIceCandidate(message.candidate);
					rtcConnections = rtcConnections;
				}
			} else if (messageType === MESSAGE_TYPE.disconnect) {
				console.log(`User disconnected: ${message.userId}`);

				const rtcConnection = rtcConnections.find((connection) => connection.user.userId === message.userId);
				rtcConnection?.connection.close();

				rtcConnections = [...rtcConnections];
			}
		};
	});
</script>

{#if !canEnterRoom}
	<div class="w-full h-full flex items-center gap-5 justify-center">
		<div class="camera-feed basis-1/2 flex flex-col gap-3 w-[400px] max-w-[400px]">
			<video class="localVideo rounded-md" autoplay muted playsinline>
				<track kind="captions" />
			</video>
			<div class="video-controls flex justify-center gap-3">
				<MicrophoneButton stream={localStream} />
				<VideoButton stream={localStream} />
			</div>
		</div>
		<div class="basis-1/2 basi flex flex-col gap-3 max-w-[400px]">
			<h1 class="text-3xl">Set your username</h1>
			<input
				type="text"
				id="username"
				class="input input-bordered"
				bind:value={username}
				placeholder="Username..."
				maxlength="30"
			/>
			<button class="btn" on:click={enterRoom}>Enter room #{roomId}</button>
		</div>
	</div>
{:else}
	<div class="flex flex-grow w-full">
		<div class="chat-section flex flex-col flex-grow">
			<div class="p-3 pr-0">
				<div class="rounded-xl flex items-center bg-base-300">
					<div class="flex items-center flex-grow gap-3 p-3">
						<div class="avatar">
							<div class="w-10 rounded-full">
								<img alt="avatar" src={`https://i.pravatar.cc/150?u=${userId}`} />
							</div>
						</div>
						<div class="text-sm">
							{username}
						</div>
						<div class="camera-feed w-[50px]">
							<video class="localVideo rounded-md" autoplay muted playsinline>
								<track kind="captions" />
							</video>
						</div>
						<MicrophoneButton stream={localStream} size="1em" btnClasses="btn-sm" />
						<VideoButton stream={localStream} size="1em" btnClasses="btn-sm" />
					</div>
					<label class="flex cursor-pointer gap-2">
						<span class="label-text text-xs">Dark</span>
						<input type="checkbox" value="light" on:change={changeTheme} class="toggle theme-controller" />
						<span class="label-text text-xs">Light</span>
					</label>
					<div class="text-sm p-3">Room #{roomId}</div>
				</div>
			</div>
			<div class="messages p-3 pl-[1.5rem] overflow-auto h-0 relative flex-grow">
				{#each $chatMessages as chatMessage}
					<div class="chat {chatMessage.userId === userId ? 'chat-end' : 'chat-start'} pr-0">
						<div class="chat-image avatar">
							<div class="w-10 rounded-full">
								<img alt="avatar" src={`https://i.pravatar.cc/150?u=${chatMessage.userId}`} />
							</div>
						</div>
						<div class="chat-header">
							<time class="text-xs opacity-50">{dayjs(chatMessage.timestamp).format('HH:MM')}</time>
						</div>
						<div
							class="chat-bubble {chatMessage.userId === userId
								? 'chat-bubble-primary'
								: 'chat-bubble-secondary'} rounded-full"
						>
							{chatMessage.content}
						</div>
					</div>
				{/each}
			</div>
			<div class="p-3 pr-0">
				<div class="inputs bg-base-300 rounded-xl p-3 flex gap-2">
					<input
						type="text"
						placeholder={`Message #${roomId}`}
						class="input input-bordered rounded-xl w-full"
						id="textInput"
						bind:value={chatInput}
						maxlength="30"
						autocomplete="off"
						on:keypress={(e) => e.key === 'Enter' && sendChat}
					/>
					<button class="btn rounded-xl min-w-[100px]" on:click={sendChat}>Send</button>
				</div>
			</div>
		</div>
		<div class="connections flex flex-col p-3 w-[300px]">
			<div class="p-3 bg-base-300 flex-grow rounded-xl shadow-md">
				{#if rtcConnections.length > 0}
					{#if connectedUsers.length}
						<div class="text-xs uppercase my-3">Online - {connectedUsers.length}</div>
						<div class="flex flex-col gap-2">
							{#each connectedUsers as connection}
								<div class="avatar-container flex items-center gap-3">
									<div class="avatar online">
										<div class="w-10 rounded-full">
											<img src={`https://i.pravatar.cc/150?u=${connection.user.userId}`} alt="" />
										</div>
									</div>
									<div class="text-sm">
										{connection.user.username}
									</div>
								</div>
								<div class="camera-feed">
									<video id={`remoteVideo-${connection.user.userId}`} class="rounded-xl hidden" autoplay playsinline>
										<track kind="captions" />
									</video>
								</div>
							{/each}
						</div>
					{/if}
					{#if disconnectedUsers.length}
						<div class="text-xs uppercase my-3">Offline - {disconnectedUsers.length}</div>
						<div class="flex flex-col gap-2">
							{#each disconnectedUsers as connection}
								<div class="avatar-container flex items-center gap-3">
									<div class="avatar offline">
										<div class="w-10 rounded-full">
											<img src={`https://i.pravatar.cc/150?u=${connection.user.userId}`} alt="" />
										</div>
									</div>
									<div class="text-sm">
										{connection.user.username}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{:else}
					<div class="p-3">No connections</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
