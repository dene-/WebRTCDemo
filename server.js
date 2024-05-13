import { WebSocketServer } from 'ws';
import TurnServer from 'node-turn';

const turnServer = new TurnServer({
	listeningPort: 1985,
	authMech: 'long-term',
	credentials: {
		fulanito: 'menganito'
	},
	debugLevel: 'INFO'
});
turnServer.start();

const wss = new WebSocketServer({ port: 1984 });

const rooms = {};

wss.on('connection', (ws) => {
	ws.on('message', (message) => {
		const data = JSON.parse(message);
		const { type } = data;

		if (type === 'connect') {
			const { user } = data;

			// Store this user's WebSocket connection
			if (user.roomId) {
				if (!rooms[user.roomId]) {
					rooms[user.roomId] = {
						users: {}
					};
				}

				ws.user = user;

				rooms[user.roomId].users[user.userId] = ws;
				console.log('Client connected to room: ', user.userId);

				// Send message to client, with the list of users in the room
				const users = Object.keys(rooms[user.roomId].users).map((id) => {
					return {
						...rooms[user.roomId].users[id].user
					};
				});

				ws.send(
					JSON.stringify({
						type: 'connect',
						users: users.filter((wsUser) => wsUser.userId !== user.userId)
					})
				);
			}
		} else if (type === 'offer') {
			const { sender, receiver, connectionId, offer } = data;

			console.log(ws.user.userId, 'is sending an offer to', receiver.userId);

			// Get ws of the other user
			const receiverSocket = rooms[receiver.roomId].users[receiver.userId];

			receiverSocket.send(
				JSON.stringify({
					type: 'offer',
					connectionId,
					receiver,
					sender,
					offer
				})
			);
		} else if (type === 'candidate') {
			const { receiver, connectionId, candidate } = data;

			// Forward the candidate to the other user
			const receiverSocket = rooms[receiver.roomId].users[receiver.userId];

			receiverSocket.send(
				JSON.stringify({
					type: 'candidate',
					sender: ws.user,
					receiver,
					connectionId,
					candidate
				})
			);
		} else if (type === 'answer') {
			const { sender, receiver, connectionId, answer } = data;
			// Forward the offer or answer to the other user
			// const room = rooms[roomId];
			console.log('Answer received from:', sender.userId);

			const receiverSocket = rooms[receiver.roomId].users[receiver.userId];

			receiverSocket.send(
				JSON.stringify({
					type: 'answer',
					sender,
					receiver,
					connectionId,
					answer
				})
			);
		}
	});

	ws.on('close', () => {
		if (!ws.user) {
			return;
		}

		console.log('Client disconnected', ws.user.userId);

		// Remove this user's WebSocket connection
		// delete rooms[ws.user.roomId].users[ws.user.userId];

		wss.clients.forEach((client) => {
			client.send(
				JSON.stringify({
					type: 'disconnect',
					userId: ws.user.userId
				})
			);
		});
	});
});
