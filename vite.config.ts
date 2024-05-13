import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fs from 'fs';
import Icons from 'unplugin-icons/vite'

export default defineConfig({
	build: {
		target: 'esnext'
	},
	plugins: [sveltekit(), Icons({ compiler: 'svelte' })],
	server: {
		https: {
			key: fs.readFileSync('./cert/key.pem'),
			cert: fs.readFileSync('./cert/cert.pem')
		},
		proxy: {}
	}
});
