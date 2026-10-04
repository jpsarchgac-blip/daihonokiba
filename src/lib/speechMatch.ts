const SKIP_RE = /[\s\u3000、。．，,.！!？?「」『』（）()\[\]【】・…—\-：:；;'"`〜~／/\\]/;

/** 認識テキストの末尾だけを見る（古いセッション全文による誤マッチを減らす） */
const SPOKEN_TAIL_LEN = 160;
/** 原稿側で飛ばしてよい文字数（言い飛ばし） */
const MAX_SCRIPT_SKIP = 10;
/** 認識側で無視する文字数（言い間違い・余計な言葉） */
const MAX_SPOKEN_SKIP_BATCH = 4;
/** 通常の1回更新で進められる最大文字数 */
export const MAX_ADVANCE_PER_UPDATE = 55;
/** 要約後の復帰など、再同期で一気に飛ばせる上限 */
const MAX_REACQUIRE_JUMP = 240;
/** 再同期を認める最低スコア */
const MIN_REACQUIRE_SCORE = 0.46;
/** この文字数以上進んだら認識バッファをクリアして再同期 */
export const RESET_SESSION_AFTER_ADVANCE = 12;

export type NormalizedScript = {
  normalized: string;
  normEndToDoc: number[];
};

export function normalizeChar(ch: string): string {
  return ch.normalize("NFKC").toLowerCase();
}

/** かなの揺れ（ひらがな/カタカナ）を揃える */
export function toMatchKana(ch: string): string {
  const c = normalizeChar(ch);
  const code = c.codePointAt(0);
  if (code === undefined) return c;
  if (code >= 0x30a1 && code <= 0x30f6) {
    return String.fromCodePoint(code - 0x60);
  }
  return c;
}

export function normalizeForMatch(text: string): string {
  let out = "";
  for (const ch of text) {
    if (SKIP_RE.test(ch)) continue;
    out += toMatchKana(ch);
  }
  return out;
}

export function buildNormalizedScript(text: string): NormalizedScript {
  let normalized = "";
  const normEndToDoc: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (SKIP_RE.test(ch)) continue;
    normalized += toMatchKana(ch);
    normEndToDoc.push(i + 1);
  }

  return { normalized, normEndToDoc };
}

export function docPositionFromNormIndex(
  map: NormalizedScript,
  normIndex: number,
): number {
  if (normIndex <= 0) return 0;
  if (normIndex >= map.normEndToDoc.length) {
    return map.normEndToDoc[map.normEndToDoc.length - 1] ?? 0;
  }
  return map.normEndToDoc[normIndex - 1] ?? 0;
}

function charsMatch(a: string, b: string): boolean {
  return toMatchKana(a) === toMatchKana(b);
}

/** 認識末尾が原稿先頭と完全一致する最長部分 */
function exactSuffixPrefixLen(remaining: string, spokenTail: string): number {
  const maxLen = Math.min(remaining.length, spokenTail.length);
  for (let len = maxLen; len > 0; len--) {
    const prefix = remaining.slice(0, len);
    if (spokenTail.endsWith(prefix)) return len;
  }
  return 0;
}

/**
 * 順序を保った緩いマッチ（原稿の飛ばし・認識のノイズを許容）
 */
function subsequenceAdvance(script: string, spoken: string): number {
  let r = 0;
  let spokenSkips = 0;

  for (let s = 0; s < spoken.length && r < script.length; s++) {
    const ch = spoken[s];
    let hit = false;
    for (let k = 0; k <= MAX_SCRIPT_SKIP && r + k < script.length; k++) {
      if (charsMatch(script[r + k], ch)) {
        r += k + 1;
        hit = true;
        spokenSkips = 0;
        break;
      }
    }
    if (!hit) {
      spokenSkips++;
      if (spokenSkips > MAX_SPOKEN_SKIP_BATCH) break;
    }
  }

  return r;
}

function orderedMatchScore(scriptSegment: string, spoken: string): number {
  if (scriptSegment.length === 0) return 0;
  let r = 0;
  let matches = 0;
  let spokenSkips = 0;

  for (let s = 0; s < spoken.length && r < scriptSegment.length; s++) {
    const ch = spoken[s];
    let hit = false;
    for (
      let k = 0;
      k <= MAX_SCRIPT_SKIP && r + k < scriptSegment.length;
      k++
    ) {
      if (charsMatch(scriptSegment[r + k], ch)) {
        r += k + 1;
        matches++;
        hit = true;
        spokenSkips = 0;
        break;
      }
    }
    if (!hit) {
      spokenSkips++;
      if (spokenSkips > MAX_SPOKEN_SKIP_BATCH) break;
    }
  }

  return matches / scriptSegment.length;
}

/**
 * 原稿先頭のどこまでが、認識テキストと「だいたい」一致しているか
 */
function fuzzyOrderedPrefixLen(remaining: string, spoken: string): number {
  const spokenSlice = spoken.slice(-96);
  const maxEnd = Math.min(remaining.length, 160);
  let best = 0;

  for (let end = 4; end <= maxEnd; end++) {
    const prefix = remaining.slice(0, end);
    const score = orderedMatchScore(prefix, spokenSlice);
    const threshold = end <= 12 ? 0.42 : 0.52;
    if (score >= threshold) best = end;
  }

  return best;
}

/** 未読原稿全体を走査し、認識と最も合う「読了位置」（remaining 内の終端オフセット） */
function findReacquireEnd(remaining: string, spoken: string): number {
  const spokenSlice = spoken.slice(-92);
  if (spokenSlice.length < 5 || remaining.length < 5) return 0;

  let bestEnd = 0;
  let bestMetric = 0;

  const startStep = remaining.length > 180 ? 2 : 1;
  const scanLimit = Math.min(remaining.length, 280);

  for (let start = 0; start < scanLimit; start += startStep) {
    const window = remaining.slice(start, Math.min(start + 110, remaining.length));
    const sub = subsequenceAdvance(window, spokenSlice);
    if (sub < 5) continue;

    const end = start + sub;
    const score = orderedMatchScore(remaining.slice(start, end), spokenSlice);
    if (score < 0.36) continue;

    const metric = score + end / (remaining.length + 80);
    if (
      metric > bestMetric ||
      (Math.abs(metric - bestMetric) < 0.025 && end > bestEnd)
    ) {
      bestMetric = metric;
      bestEnd = Math.max(bestEnd, end);
    }
  }

  for (let len = Math.min(32, spokenSlice.length); len >= 5; len--) {
    const frag = spokenSlice.slice(-len);
    let from = 0;
    while (from < remaining.length) {
      const idx = remaining.indexOf(frag, from);
      if (idx < 0) break;
      bestEnd = Math.max(bestEnd, idx + len);
      from = idx + 1;
    }
  }

  for (let len = Math.min(20, spokenSlice.length); len >= 6; len--) {
    for (let s = 0; s + len <= spokenSlice.length; s++) {
      const frag = spokenSlice.slice(s, s + len);
      const idx = remaining.indexOf(frag);
      if (idx >= 0) {
        const end = idx + len;
        const tailScore = orderedMatchScore(
          remaining.slice(idx, Math.min(remaining.length, end + 24)),
          spokenSlice,
        );
        if (tailScore >= 0.34) {
          bestEnd = Math.max(bestEnd, end);
        }
      }
    }
  }

  return bestEnd;
}

function reacquireConfidence(
  remaining: string,
  spoken: string,
  end: number,
): number {
  if (end <= 0) return 0;
  const spokenSlice = spoken.slice(-88);
  const winLen = Math.min(36, end);
  const segStart = end - winLen;
  const segment = remaining.slice(segStart, end);
  const score = orderedMatchScore(segment, spokenSlice);
  for (let len = Math.min(16, spokenSlice.length); len >= 6; len--) {
    const frag = spokenSlice.slice(-len);
    if (remaining.slice(end - len, end) === frag) {
      return Math.max(score, 0.72);
    }
  }
  return score;
}

/**
 * 認識テキストと原稿の未読部分を突き合わせ、読み進めた正規化インデックスを返す。
 */
export function matchReadProgress(
  map: NormalizedScript,
  currentNormIndex: number,
  spokenBuffer: string,
): number {
  if (currentNormIndex >= map.normalized.length) return currentNormIndex;

  const spoken = normalizeForMatch(spokenBuffer);
  if (!spoken) return currentNormIndex;

  const remaining = map.normalized.slice(currentNormIndex);
  const tail = spoken.slice(-SPOKEN_TAIL_LEN);

  const prefixAdvance = Math.max(
    exactSuffixPrefixLen(remaining, tail),
    subsequenceAdvance(remaining, tail),
    fuzzyOrderedPrefixLen(remaining, tail),
  );

  const reacquireEnd = findReacquireEnd(remaining, tail);
  let targetEnd = Math.max(prefixAdvance, reacquireEnd);

  if (reacquireEnd > prefixAdvance + 12) {
    const conf = reacquireConfidence(remaining, tail, reacquireEnd);
    if (conf < 0.38) {
      targetEnd = prefixAdvance;
    }
  }

  if (targetEnd <= 0) return currentNormIndex;

  let advance = targetEnd;
  if (advance > MAX_ADVANCE_PER_UPDATE) {
    const conf = reacquireConfidence(remaining, tail, advance);
    if (conf >= 0.4 && advance <= MAX_REACQUIRE_JUMP) {
      /* 要約後の復帰: 大きなジャンプを許可 */
    } else {
      advance = Math.min(advance, MAX_ADVANCE_PER_UPDATE);
    }
  }

  advance = Math.min(advance, remaining.length);
  return Math.min(currentNormIndex + advance, map.normalized.length);
}

export function isScriptFullyRead(
  map: NormalizedScript,
  normIndex: number,
): boolean {
  return normIndex >= map.normalized.length;
}
