import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/Polynomial-Cauchy-Coordinates-for-Curved-Cages' : '',
			relative: true, // 相対パスを有効にする
		}
	}
};

export default config;