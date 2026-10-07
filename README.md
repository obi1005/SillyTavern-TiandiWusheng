# 天地無聲勢

SillyTavern 擴充。生成期間播放一段無聲音訊，讓 iPhone 的 Safari 切到背景時不會暫停頁面，訊息生成就不會被中斷。

## 為什麼需要它

iPhone 的 Safari 只要不在前景，頁面就會被系統暫停，連線跟著斷掉；SillyTavern 一偵測到斷線就會取消生成。
iOS 會讓「正在播放聲音」的網頁在背景繼續執行，這個擴充就是利用這一點。

## 安裝

SillyTavern →「擴充功能」→「安裝擴充功能」，貼上：

```
https://github.com/obi1005/SillyTavern-TiandiWusheng
```

## 使用

1. 重新整理頁面後，**先隨便點一下畫面**（點輸入框就行）。iOS 規定網頁第一次出聲必須由使用者親手觸發，這一下是在解鎖。
2. 照常送出訊息，就可以切去別的 App。
3. 生成期間，控制中心和鎖定畫面會出現正在播放的「天地無聲勢」，代表它在運作。生成結束就自動停止。
4. 如果生成是在背景完成的，切回 Safari 時會自動補存一次聊天紀錄（iOS 可能擋掉背景中的存檔請求）。

如果面板狀態顯示「被打斷了」或「未能起勢」（例如生成中有來電、Siri 或別的 App 出聲），點一下畫面就會接上，不用重新整理。

設定在擴充功能面板的「天地無聲勢」裡，可以隨時關閉；標題旁會顯示目前的版本號。

## 注意

- 生成期間會暫停其他 App 正在播的音樂（iOS 的聲音通道同時只能給一個）。
- 在鎖定畫面按了暫停，保護就失效。
- 就算沒收到生成結束的訊號，最多播十分鐘也會自動停止。
- 目前只在 iPhone 的 Safari 實測過；Android 的 Chrome 尚待實測。

## English

Plays a silent audio loop while SillyTavern is generating, so iOS Safari keeps the page alive in the background and the generation isn't cut off when you switch apps. Tap the page once after it loads to unlock audio playback (an iOS requirement).

## 授權

MIT
