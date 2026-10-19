# 購物網站前端示範

這是一個使用 React 和 Vite 製作的購物網站前端練習專案，包含商品瀏覽、購物車、結帳表單和 EmailJS 訂單通知。

## 功能

- 瀏覽商品並加入購物車
- 填寫結帳資料並建立訂單
- 設定 EmailJS 後，寄送訂單通知信
- 訂單成功後可選擇關閉視窗或繼續逛逛

## 使用技術

- React
- TypeScript
- Vite
- EmailJS

## 在本機啟動

1. 安裝套件：

   ```bash
   npm install
2. 將 .env.example 複製成 .env，填入自己的 EmailJS 設定：
   VITE_EMAILJS_SERVICE_ID=你的ServiceID
   VITE_EMAILJS_TEMPLATE_ID=你的TemplateID
   VITE_EMAILJS_PUBLIC_KEY=你的PublicKey
3. 啟動網站：
   npm run dev
注意事項
-
- 上傳不含實際金鑰的 .env.example。
- 這是前端示範專案，目前沒有連接資料庫，也沒有處理實際付款。
