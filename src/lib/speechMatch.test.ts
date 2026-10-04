import assert from "node:assert/strict";
import {
  buildNormalizedScript,
  matchReadProgress,
  normalizeForMatch,
} from "./speechMatch";

function run() {
  const script = "本日はお集まりいただきありがとうございます";
  const map = buildNormalizedScript(script);

  let pos = 0;
  pos = matchReadProgress(
    map,
    pos,
    normalizeForMatch("ほんじつはおあつまり"),
  );
  assert.ok(pos > 5, "ひらがな認識で先頭付近まで進む");

  pos = matchReadProgress(
    map,
    pos,
    normalizeForMatch("ほんじつはおあつまりいただきありがとう"),
  );
  assert.ok(pos >= 10, "途中まで緩く追従");

  const script2 = "プロダクトの方向性を共有します";
  const map2 = buildNormalizedScript(script2);
  const pos2 = matchReadProgress(
    map2,
    0,
    normalizeForMatch("ぷろだくとのほうこうせいをきょうゆう"),
  );
  assert.ok(pos2 >= 8, "漢字と読みのズレを許容");

  const long =
    "はじめに本日の目的を説明します。次に課題感についてお話しします。最後にまとめと質疑応答に進みます。";
  const mapLong = buildNormalizedScript(long);
  const stuck = 5;
  const reacquired = matchReadProgress(
    mapLong,
    stuck,
    normalizeForMatch("まとめと質疑応答に進みます"),
  );
  assert.ok(
    reacquired > stuck + 20,
    "要約で飛ばした後、後半の原稿に戻ったらそこへジャンプ",
  );

  console.log("speechMatch.test.ts: ok");
}

run();
