<script lang="ts">
	import MdiMicrophone from 'virtual:icons/mdi/microphone';
	import MdiMicrophoneOff from 'virtual:icons/mdi/microphone-off';
	import { onMount } from 'svelte';

	export let stream: MediaStream;
	export let size: string = '1.5em';
	export let btnClasses: string = '';

	let isMuted = false;

	const toggleMute = () => {
		isMuted = !isMuted;
		stream.getAudioTracks().forEach((track) => {
			track.enabled = !isMuted;
		});
	};

	onMount(() => {
		if (!stream) {
			isMuted = false;
			return;
		}

		isMuted = stream.getAudioTracks().every((track) => !track.enabled);
	});
</script>

<button
	class="btn btn-secondary btn-circle {btnClasses} {isMuted
		? 'bg-red-700 hover:bg-red-900 border-red-700 hover:border-red-900'
		: ''}"
	on:click={toggleMute}
>
	{#if isMuted}
		<MdiMicrophoneOff style="font-size: {size}" />
	{:else}
		<MdiMicrophone style="font-size: {size}" />
	{/if}
</button>
