# Acrylic Charms 3D

画像をアップロードすると3Dのアクリルスタンド（アクスタ）として表示されるWebアプリのプロトタイプを作成してください。

【要件】

1. フロントエンド技術: React, Tailwind CSS, Three.js (React Three Fiber)

2. 画像アップロード機能:

   - ユーザーが画像をドラッグ＆ドロップまたはファイル選択でアップロードできる

   - アップロードされた画像の背景を簡易的に透過（または切り抜き）処理する

3. 3Dアクリルスタンド表現:

   - 3D空間内に、アップロードした画像テクスチャを貼り付けたアクリルスタンド風の板ポリゴンを生成する

   - アクリル板特有の厚み、光沢（透明感のあるエッジ）、台座（丸い透明パーツ）を3Dで再現する

   - マウスのドラッグ操作でカメラを回転・ズームしてアクスタを360度観察できる

4. デザイン:

   - 洗練されたモダンでクリーンなUI（ダークモードまたは半透明グラスモーフィズム調）

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d474fd0d-5d6a-4d03-b6a9-d3af252c7b42).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
