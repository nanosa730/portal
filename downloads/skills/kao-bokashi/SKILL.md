---
name: "kao-bokashi"
description: "写真に写った人の顔をぼかす。「顔をぼかして」「モザイクをかけて」「HP用に顔がわからないようにして」などの依頼で、写真が添付されていれば必ず使う。"
---

# 顔ぼかし

学校HPや配布物に使う写真の顔を、自動検出＋目視確認でぼかす。複数枚まとめて処理できる。

## 大原則：講師やゲストの顔はぼかさない

- ぼかすのは**生徒とその他の一般参加者**。講師・ゲスト（招いた選手、講演者、イベントを進める側の人）の顔はぼかさない。
- 講師・ゲストの見分け方の例：イベントのロゴ入りポロシャツ・スタッフ用の服、マイクを持って話している、全体の前で説明・実演している、生徒と制服や体操服が違う。ビブスを着ていても講師の場合がある。
- 処理の前に全枚を見て、講師・ゲストらしい人を拾い出し、各写真でその人の顔の中心を KEEP に入れる。
- 講師か生徒・教員か判断できない人は、ぼかしたままにして報告で「この人は講師ですか？」と写真名・服装・位置を添えて聞く。

## 手順

1. 添付写真を作業フォルダにコピーする（元ファイルは変更しない）。
2. 顔検出モデル YuNet を取得する（GitHubのLFSは本体が取れないので media URL を使う）。
   ```bash
   mkdir -p model && curl -sSL -o model/yunet.onnx https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
   ```
   ファイルが200KB前後あることを確認（数百バイトならLFSポインタなので失敗）。opencv-python が無ければ pip install --break-system-packages opencv-python。
3. 下の blur.py を保存して一度実行し、dbg/ の枠付き画像（半分に縮小済み）で講師・ゲストの顔の位置を確かめて KEEP に入れる。
   `python3 blur.py model/yunet.onnx <入力フォルダ> out dbg 0.5 2>/dev/null`
   （OpenCVの警告が大量に出るので標準エラーは捨てる）
4. **必ず目視確認する。** dbg/ と out/ を Read で見て、次を確認する。
   - 講師・ゲストの顔がぼけていないか（各写真で顔を切り出して並べて確認する）
   - 誤検出：後頭部・服・手元・壁などに枠がないか（大きくて点数の低い枠が要注意）。不要な枠はその中心を KEEP に入れれば消せる
   - 見落とし：横顔・うつむき・遠くの立っている人・手で顔が隠れかけた人。EXTRA に (x, y, w, h) で追加して再実行
   - 縮小プレビューで読んだ座標は倍率を戻してから使う
5. 出力：ファイル名を「元の名前_ぼかし.jpg」にして /mnt/user-data/outputs/ に置き、送信する。パソコンがつながっていれば、ダウンロードフォルダに「顔ぼかし済み_日付」フォルダを作って直接保存する（チャットからダウンロードできないことがあるため）。
6. 報告は簡潔に。保存場所、ぼかさなかった講師・ゲスト、判断に迷った人（あれば）、後ろ向きの人はぼかしていないこと、を伝える。

## blur.py

```python
import cv2, sys, os, glob, json
import numpy as np

MODEL, SRC, OUT, DBG = sys.argv[1:5]
TH = float(sys.argv[5]) if len(sys.argv) > 5 else 0.5
os.makedirs(OUT, exist_ok=True); os.makedirs(DBG, exist_ok=True)

# 検出できなかった顔を手動で追加（ファイル名: [(x, y, w, h), ...] 元画像の座標）
EXTRA = {}
# ぼかさない人（講師・ゲスト）の顔の中心、または消したい誤検出枠の中心（ファイル名: [(x, y), ...] 元画像の座標）
KEEP = {}

def detect(img, scale):
    h, w = img.shape[:2]
    im = cv2.resize(img, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_CUBIC) if scale != 1 else img
    H, W = im.shape[:2]; tile, step = 1280, 1000; boxes = []
    for y in range(0, max(1, H - tile + step), step):
        for x in range(0, max(1, W - tile + step), step):
            crop = im[y:y+tile, x:x+tile]; ch, cw = crop.shape[:2]
            d = cv2.FaceDetectorYN.create(MODEL, "", (cw, ch), TH, 0.3, 5000)
            _, faces = d.detect(crop)
            if faces is None: continue
            for f in faces:
                bx, by, bw, bh = f[:4]
                boxes.append([(bx+x)/scale, (by+y)/scale, bw/scale, bh/scale, float(f[-1])])
    return boxes

def nms(boxes):
    if not boxes: return []
    b = np.array(boxes)
    idx = cv2.dnn.NMSBoxes([[float(v) for v in r[:4]] for r in b], b[:, 4].tolist(), 0.0, 0.3)
    return [boxes[i] for i in np.array(idx).flatten()]

report = {}
for p in sorted(glob.glob(os.path.join(SRC, "*.jpg")) + glob.glob(os.path.join(SRC, "*.jpeg")) + glob.glob(os.path.join(SRC, "*.png"))):
    img = cv2.imread(p); h, w = img.shape[:2]
    name = os.path.basename(p)
    # 等倍＋2倍で検出（遠くの小さい顔対策）
    boxes = nms(detect(img, 1.0) + detect(img, 2.0))
    # 後頭部などの誤検出を除く：大きくて自信が低い枠、極端に縦長の枠
    boxes = [b for b in boxes if (b[4] >= 0.75 or max(b[2], b[3]) <= 70) and b[3]/max(b[2], 1) <= 1.8]
    boxes += [list(b) + [1.0] for b in EXTRA.get(name, [])]
    # 講師・ゲスト：KEEPの点を含む枠はぼかさない
    keep = KEEP.get(name, [])
    boxes = [b for b in boxes if not any(b[0] <= kx <= b[0]+b[2] and b[1] <= ky <= b[1]+b[3] for kx, ky in keep)]
    out = img.copy(); dbg = img.copy()
    for bx, by, bw, bh, s in boxes:
        # 髪・あごまで覆うよう余白を広めに取り、楕円マスクでなじませる
        cx, cy = bx + bw/2, by + bh/2
        x0, y0 = int(max(0, cx - bw*0.8)), int(max(0, cy - bh*0.95))
        x1, y1 = int(min(w, cx + bw*0.8)), int(min(h, cy + bh*0.95))
        roi = out[y0:y1, x0:x1]
        if roi.size == 0: continue
        k = max(15, int(max(bw, bh)*0.9) | 1)
        bl = cv2.GaussianBlur(cv2.GaussianBlur(roi, (k, k), 0), (k, k), 0)
        mask = np.zeros(roi.shape[:2], np.uint8)
        cv2.ellipse(mask, ((x1-x0)//2, (y1-y0)//2), ((x1-x0)//2, (y1-y0)//2), 0, 0, 360, 255, -1)
        mask = cv2.GaussianBlur(mask, (0, 0), max(2, bw*0.08)).astype(np.float32)[..., None]/255
        out[y0:y1, x0:x1] = (bl*mask + roi*(1-mask)).astype(np.uint8)
        cv2.rectangle(dbg, (x0, y0), (x1, y1), (0, 0, 255), 3)
        cv2.putText(dbg, f"{s:.2f}", (x0, y0-4), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
    for kx, ky in keep:
        cv2.circle(dbg, (int(kx), int(ky)), 12, (0, 200, 0), 4)  # 緑の丸：ぼかさない人
    cv2.imwrite(os.path.join(OUT, name), out, [cv2.IMWRITE_JPEG_QUALITY, 92])
    cv2.imwrite(os.path.join(DBG, name), cv2.resize(dbg, (w//2, h//2)), [cv2.IMWRITE_JPEG_QUALITY, 80])
    report[name] = len(boxes)
print(json.dumps(report, ensure_ascii=False, indent=1))
```

## 注意

- dbg/ の画像は半分に縮小してある。そこで読んだ座標を EXTRA や KEEP に使うときは2倍する。
- ぼかしが弱いと感じたら k の係数（0.9）を上げる。
- 後ろ向きの人の後頭部はぼかさない（不自然な塊になるため）。
- 黒塗りやモザイクを指定されたら、ぼかし処理の部分をその方式に替える。