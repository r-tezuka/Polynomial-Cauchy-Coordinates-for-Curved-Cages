import adapter from '@sveltejs/adapter-static';

const config = {
	kit: {
		adapter: adapter({
			// optional: 以下の設定を必要に応じて変更
			pages: 'build', // ビルドされた静的ファイルを出力するフォルダー
			assets: 'build', // 静的アセットの出力先
			fallback: null,  // `404.html`が必要な場合は指定
		}),
		paths: {
			// GitHub Pagesのサブディレクトリ名を指定
			base: process.env.NODE_ENV === 'production' ? '/Polynomial-Cauchy-Coordinates-for-Curved-Cages' : '',
		}
	}
};

export default config;