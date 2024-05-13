<script lang="ts">
	import MdiVideo from 'virtual:icons/mdi/video';
	import MdiVideoOff from 'virtual:icons/mdi/video-off';
	import { onMount } from 'svelte';

	export let stream: MediaStream;
	export let size: string = '1.5em';
	export let btnClasses: string = '';

	let isEnabled = true;

	const toggleMute = () => {
		isEnabled = !isEnabled;
		stream.getVideoTracks().forEach((track) => {
			track.enabled = isEnabled;
		});
	};

	onMount(() => {
		if (!stream) {
			isEnabled = true;
			return;
		}

		isEnabled = stream.getVideoTracks().every((track) => track.enabled);
	});
</script>

<button
	class="btn btn-secondary btn-circle {btnClasses} {!isEnabled
		? 'bg-red-700 hover:bg-red-900 border-red-700 hover:border-red-900'
		: ''}"
	on:click={toggleMute}
>
	{#if isEnabled}
		<MdiVideo style="font-size: {size}" />
	{:else}
		<MdiVideoOff style="font-size: {size}" />
	{/if}
</button>
