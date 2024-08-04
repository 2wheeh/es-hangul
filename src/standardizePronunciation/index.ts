import { isNotUndefined, joinString } from '../_internal';
import { isHangulAlphabet, isHangulCharacter } from '../_internal/hangul';
import { combineHangulCharacter } from '../combineHangulCharacter';
import { disassembleCompleteHangulCharacter } from '../disassembleCompleteHangulCharacter';
import {
  transform12th,
  transform13And14th,
  transform16th,
  transform17th,
  transform18th,
  transform19th,
  transform20th,
  transform9And10And11th,
  transformHardConversion,
  transformNLAssimilation,
  type Nullable,
  type Syllable,
} from './rules';

type Options = {
  hardConversion: boolean;
  complete?: CompletionMode;
};

type NotHangul = {
  index: number;
  syllable: string;
};

/**
 * 주어진 한글 문자열을 표준 발음으로 변환합니다.
 * @param hangul 한글 문자열을 입력합니다.
 * @param options 변환 옵션을 설정합니다.
 * @param options.hardConversion 경음화 등의 된소리를 적용할지 여부를 설정합니다. 기본값은 true입니다.
 * @param options.complete 완성되지 않은 한글자모를 변환할 방법을 설정합니다. 'simple': ㄱ => 그, 'verbose': ㄱ => 기역. 설정하지 않으면 완성되지 않은 한글은 별도로 변환하지 않습니다.
 * @returns 변환된 표준 발음 문자열을 반환합니다.
 */
export function standardizePronunciation(hangul: string, options: Options = { hardConversion: true }): string {
  if (!hangul) {
    return '';
  }

  const processSyllables = (syllables: Syllable[], phrase: string, options: Options) =>
    syllables.map((currentSyllable, index, array) => {
      const nextSyllable = index < array.length - 1 ? array[index + 1] : null;

      const { current, next } = applyRules({
        currentSyllable,
        phrase,
        index,
        nextSyllable,
        options,
      });

      if (next) {
        array[index + 1] = next;
      }

      return current;
    });

  const transformHangulPhrase = (phrase: string, options: Options): string => {
    if (options.complete) {
      phrase = completeHangulSyllable(phrase, options.complete);
    }

    const { notHangulPhrase, disassembleHangul } = 음절분해(phrase);
    const processedSyllables = processSyllables(disassembleHangul, phrase, options);

    return assembleChangedHangul(processedSyllables, notHangulPhrase);
  };

  return hangul
    .split(' ')
    .map(phrase => transformHangulPhrase(phrase, options))
    .join(' ');
}

// 음가, 명칭 phonetic, name, letterName, sound,
export type CompletionMode = 'phonetic' | 'letterName';

interface CompletionMap {
  [key: string]: string;
}

const completionMaps: Record<CompletionMode, CompletionMap> = {
  phonetic: {
    ㄱ: '그',
    ㄴ: '느',
    ㄷ: '드',
    ㄹ: '르',
    ㅁ: '므',
    ㅂ: '브',
    ㅅ: '스',
    ㅇ: '으',
    ㅈ: '즈',
    ㅊ: '츠',
    ㅋ: '크',
    ㅌ: '트',
    ㅍ: '프',
    ㅎ: '흐',
    ㄲ: '끄',
    ㄸ: '뜨',
    ㅃ: '쁘',
    ㅆ: '쓰',
    ㅉ: '쯔',
    ㄳ: '그스',
    ㄵ: '느즈',
    ㄶ: '느흐',
    ㄺ: '르그',
    ㄻ: '르므',
    ㄼ: '르브',
    ㄽ: '르스',
    ㄾ: '르트',
    ㄿ: '르프',
    ㅀ: '르흐',
    ㅄ: '브스',
    ㅏ: '아',
    ㅑ: '야',
    ㅓ: '어',
    ㅕ: '여',
    ㅗ: '오',
    ㅛ: '요',
    ㅜ: '우',
    ㅠ: '유',
    ㅡ: '으',
    ㅣ: '이',
    ㅐ: '애',
    ㅒ: '얘',
    ㅔ: '에',
    ㅖ: '예',
    ㅘ: '와',
    ㅙ: '왜',
    ㅚ: '외',
    ㅝ: '워',
    ㅞ: '웨',
    ㅟ: '위',
    ㅢ: '의',
  },
  letterName: {
    ㄱ: '기역',
    ㄴ: '니은',
    ㄷ: '디귿',
    ㄹ: '리을',
    ㅁ: '미음',
    ㅂ: '비읍',
    ㅅ: '시옷',
    ㅇ: '이응',
    ㅈ: '지읒',
    ㅊ: '치읓',
    ㅋ: '키읔',
    ㅌ: '티읕',
    ㅍ: '피읖',
    ㅎ: '히읗',
    ㄲ: '쌍기역',
    ㄸ: '쌍디귿',
    ㅃ: '쌍비읍',
    ㅆ: '쌍시옷',
    ㅉ: '쌍지읒',
    ㄳ: '기역시옷',
    ㄵ: '니은지읒',
    ㄶ: '니은히읗',
    ㄺ: '리을기역',
    ㄻ: '리을미음',
    ㄼ: '리을비읍',
    ㄽ: '리을시옷',
    ㄾ: '리을티읕',
    ㄿ: '리을피읖',
    ㅀ: '리을히읗',
    ㅄ: '비읍시옷',
    ㅏ: '아',
    ㅑ: '야',
    ㅓ: '어',
    ㅕ: '여',
    ㅗ: '오',
    ㅛ: '요',
    ㅜ: '우',
    ㅠ: '유',
    ㅡ: '으',
    ㅣ: '이',
    ㅐ: '애',
    ㅒ: '얘',
    ㅔ: '에',
    ㅖ: '예',
    ㅘ: '와',
    ㅙ: '왜',
    ㅚ: '외',
    ㅝ: '워',
    ㅞ: '웨',
    ㅟ: '위',
    ㅢ: '의',
  },
};

const jamoRegex = /[ㄱ-ㅣ]/g;

// 자모를 완성된 음절로 변환합니다.
const completeHangulSyllable = (text: string, mode: CompletionMode) =>
  text.replace(jamoRegex, jamo => completionMaps[mode][jamo] || jamo);

function 음절분해(hangulPhrase: string): {
  notHangulPhrase: NotHangul[];
  disassembleHangul: Syllable[];
} {
  const notHangulPhrase: NotHangul[] = [];
  const disassembleHangul = Array.from(hangulPhrase)
    .filter((syllable, index) => {
      if (!isHangulCharacter(syllable) || isHangulAlphabet(syllable)) {
        notHangulPhrase.push({
          index,
          syllable,
        });

        return false;
      }

      return true;
    })
    .map(disassembleCompleteHangulCharacter)
    .filter(isNotUndefined);

  return { notHangulPhrase, disassembleHangul };
}

type ApplyParameters = {
  currentSyllable: Syllable;
  nextSyllable: Nullable<Syllable>;
  index: number;
  phrase: string;
  options: NonNullable<Parameters<typeof standardizePronunciation>[1]>;
};

function applyRules(params: ApplyParameters): {
  current: Syllable;
  next: Nullable<Syllable>;
} {
  const { currentSyllable, nextSyllable, index, phrase, options } = params;

  let current = { ...currentSyllable };
  let next = nextSyllable ? { ...nextSyllable } : nextSyllable;

  if (next && options.hardConversion) {
    ({ next } = transformHardConversion(current, next));
  }

  if (next) {
    ({ current, next } = transform16th({
      currentSyllable: current,
      nextSyllable: next,
      index,
      phrase,
    }));
    ({ current, next } = transform17th(current, next));
    ({ next } = transform19th(current, next));
    ({ current, next } = transformNLAssimilation(current, next));
    ({ current } = transform18th(current, next));
    ({ current, next } = transform20th(current, next));
  }

  ({ current, next } = transform12th(current, next));

  if (next) {
    ({ current, next } = transform13And14th(current, next));
  }

  ({ current } = transform9And10And11th(current, next));

  return {
    current,
    next,
  };
}

function assembleChangedHangul(disassembleHangul: Syllable[], notHangulPhrase: NotHangul[]): string {
  const changedSyllables = disassembleHangul
    .filter(isNotUndefined)
    .map(syllable => combineHangulCharacter(syllable.first, syllable.middle, syllable.last));

  for (const { index, syllable } of notHangulPhrase) {
    changedSyllables.splice(index, 0, syllable);
  }

  return joinString(...changedSyllables);
}
