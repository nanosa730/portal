// 保護者への案内文（記書き形式）Word生成スクリプト
// 初回のみ senderOrg / senderName を自校のものに書き換える。
// 案件ごとに issueDate / title / intro / body / items / outputPath を書き換えて使用する。
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun
} = require("docx");
const fs = require("fs");

// ==== 初回のみ設定する（差出人情報） ====
const senderOrg = "〇〇市立〇〇中学校長";      // 例: 〇〇市立〇〇中学校長
const senderName = "〇　〇　〇　〇";            // 姓と名を1字ずつ全角スペースで区切る

// ==== ここから案件ごとに書き換える ====
const issueDate = "令和8年7月13日"; // 発行日（右揃え・文書冒頭）

const title = "〇〇について"; // 「（お知らせ）」は付けない

const intro = "いつも本校の教育活動にご理解・ご協力をいただき、誠にありがとうございます。";

const body =
  "さて、本校では〇〇について〇〇を進めてまいりました。\n" +
  "つきましては、下記の通り〇〇を実施いたします。";

// 記の項目：label（項目名）、text（内容、複数行は\nで区切る）、
// 必要ならimagePath（二次元コードなど段落内に挿入する画像。幅・高さはpx目安）
const items = [
  { label: "日時", text: "〇月〇日（〇）〇時〇分から" },
  { label: "場所", text: "本校〇〇" },
  {
    label: "参加方法",
    text: "右の二次元コードよりお申し込みください\n（https://example.com/form）",
    imagePath: null, // 例: "./qr.png"
    imageWidth: 100,
    imageHeight: 100,
  },
  { label: "締切", text: "〇月〇日（〇）〇時まで" },
];

const outputPath = "./保護者案内文.docx";
// ==== ここまで案件ごとに書き換える ====

// 全角数字（項目番号）
const zenkakuDigits = ["０","１","２","３","４","５","６","７","８","９"];
function toZenkakuNumber(n) {
  return String(n)
    .split("")
    .map((d) => zenkakuDigits[Number(d)])
    .join("");
}

function textParagraphs(text, opts = {}) {
  return text.split("\n").map(
    (line) =>
      new Paragraph({
        alignment: opts.alignment || AlignmentType.LEFT,
        spacing: { after: 100 },
        children: [new TextRun({ text: line, size: 22 })],
      })
  );
}

const children = [];

// 1. 発行日（右揃え）
children.push(
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 200 },
    children: [new TextRun({ text: issueDate, size: 22 })],
  })
);

// 2. 宛名（左揃え）
children.push(
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 200 },
    children: [new TextRun({ text: "保護者　様", size: 22 })],
  })
);

// 3. 差出人（右揃え）
children.push(
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 0 },
    children: [new TextRun({ text: senderOrg, size: 22 })],
  })
);
children.push(
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 300 },
    children: [new TextRun({ text: senderName, size: 22 })],
  })
);

// 4. タイトル（中央揃え）
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [new TextRun({ text: title, bold: true, size: 28 })],
  })
);

// 5. 挨拶
children.push(...textParagraphs(intro));

// 6. 本文
children.push(...textParagraphs(body));
children.push(new Paragraph({ text: "", spacing: { after: 100 } }));

// 7. 「記」（中央揃え）
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [new TextRun({ text: "記", bold: true, size: 24 })],
  })
);

// 8. 項目（全角数字＋全角スペース、「、」は付けない）
items.forEach((item, idx) => {
  const num = toZenkakuNumber(idx + 1);
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 50 },
      children: [
        new TextRun({ text: `${num}　${item.label}`, bold: true, size: 22 }),
      ],
    })
  );
  item.text.split("\n").forEach((line) => {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        indent: { left: 400 },
        spacing: { after: 150 },
        children: [new TextRun({ text: line, size: 22 })],
      })
    );
  });
  // 二次元コードなどの画像があれば項目の直後に挿入
  if (item.imagePath && fs.existsSync(item.imagePath)) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        indent: { left: 400 },
        spacing: { after: 200 },
        children: [
          new ImageRun({
            type: "png",
            data: fs.readFileSync(item.imagePath),
            transformation: {
              width: item.imageWidth || 100,
              height: item.imageHeight || 100,
            },
          }),
        ],
      })
    );
  }
});

const doc = new Document({
  sections: [
    {
      properties: {
        page: { size: { width: 11906, height: 16838 } }, // A4
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.mkdirSync(require("path").dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buf);
  console.log("Wrote:", outputPath);
});
