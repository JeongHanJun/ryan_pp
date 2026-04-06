import { useRef, useState, useCallback, useEffect } from 'react';

const TRACK_FILES = [
  '001_로그인.mp3',
  '002_월드, 캐릭터 선택.mp3',
  '003_버섯 마을.mp3',
  '004_토마토 밭.mp3',
  '005_리스 항구.mp3',
  '006_헤네시스 사냥터.mp3',
  '007_엘리니아 남쪽 숲.mp3',
  '008_엘리니아 남쪽 숲 나무 던전.mp3',
  '009_엘리니아.mp3',
  '010_마법 도서관.mp3',
  '011_페리온.mp3',
  '012_전사의 성전.mp3',
  '013_페리온 서쪽 바위산.mp3',
  '014_커닝 시티.mp3',
  '015_슬리피 우드.mp3',
  '016_개미굴.mp3',
  '017_이블 아이의 굴.mp3',
  '018_캐시 샵.mp3',
  '019_커닝 시티 방황의 늪.mp3',
  '020_커닝 시티 지하철.mp3',
  '021_플로리나 비치.mp3',
  '022_로그인(신).mp3',
  '023_행복한 마을.mp3',
  '024_크리스마스의 언덕.mp3',
  '025_리스 항구(신).mp3',
  '026_커닝 시티 니은 숲(신).mp3',
  '027_커닝 시티 게임방(신).mp3',
  '028_오르비스행.mp3',
  '029_크림슨 발록.mp3',
  '030_오르비스.mp3',
  '031_얼음 골짜기.mp3',
  '032_늑대의 영역.mp3',
  '033_오르비스 탑.mp3',
  '034_올라~ 올라~.mp3',
  '035_고지를 향해서.mp3',
  '036_폐광.mp3',
  '037_시련의 동굴.mp3',
  '038_알려지지 않은 폐광.mp3',
  '039_자쿰의 제단.mp3',
  '040_자쿰.mp3',
  '041_루디브리엄행.mp3',
  '042_루디브리엄.mp3',
  '043_장난감 공장.mp3',
  '044_시간의 길.mp3',
  '045_에오스 탑.mp3',
  '046_에오스 탑.mp3',
  '047_지구 방위 본부.mp3',
  '048_지구 방위 본부 격납고.mp3',
  '049_로스웰 초원.mp3',
  '050_쿨란 초원.mp3',
  '051_버려진 탑.mp3',
  '052_버려진 탑의 암흑.mp3',
  '053_시공의 균열.mp3',
  '054_뒤틀린 시간의 길.mp3',
  '055_삐뚤어진 시간.mp3',
  '056_뒤틀린 회랑.mp3',
  '057_잊힌 시간의 길.mp3',
  '058_사라진 시간.mp3',
  '059_잊힌 회랑.mp3',
  '060_시계탑의 근원.mp3',
  '061_바다 나들목.mp3',
  '062_아쿠아리움.mp3',
  '063_뾰족한 사각지대.mp3',
  '064_아랫마을.mp3',
  '065_까막산.mp3',
  '066_깊은 바다 협곡.mp3',
  '067_피아누스의 동굴.mp3',
  '068_페리온 유적 발굴 현장.mp3',
  '069_샤레니안.mp3',
  '070_샤레니안 지하 수로.mp3',
  '071_에레고스의 왕좌.mp3',
  '072_코-크 타운.mp3',
  '073_여신의 탑.mp3',
  '074_여신의 탑 정원.mp3',
  '075_리프레.mp3',
  '076_하늘 둥지.mp3',
  '077_불과 어둠의 전장.mp3',
  '078_용의 숲.mp3',
  '079_남겨진 용의 둥지.mp3',
  '080_생명의 동굴.mp3',
  '081_혼테일의 동굴.mp3',
  '082_세계 여행 대만 서문정.mp3',
  '083_세계 여행 대만 야시장.mp3',
  '084_세계 여행 대만 야시장 거리.mp3',
  '085_세계 여행 중국 상해 와이탄.mp3',
  '086_세계 여행 중국 상해 교외.mp3',
  '087_세계 여행 일본 버섯 신사.mp3',
  '088_세계 여행 일본 월하죽림.mp3',
  '089_세계 여행 태국 플로팅 마켓.mp3',
  '090_세계 여행 태국 화려한 늪.mp3',
  '091_무릉.mp3',
  '092_야생 곰의 영토.mp3',
  '093_백초 마을.mp3',
  '094_빨간 코 해적단 소굴.mp3',
  '095_아리안트.mp3',
  '096_선인장 사막.mp3',
  '097_붉은 모래 사막.mp3',
  '098_마가티아.mp3',
  '099_웨딩홀 로비.mp3',
  '100_웨딩홀(.mp3',
  '101_웨딩홀(.mp3',
  '102_헌티드 맨션.mp3',
  '103_노틸러스 선착장.mp3',
  '104_노틸러스호.mp3',
  '105_아리안트 투기장.mp3',
  '106_엘린 숲.mp3',
  '107_독 안개의 숲.mp3',
  '108_시간의 신전.mp3',
  '109_추억의 길.mp3',
  '110_후회의 길.mp3',
  '111_망각의 길.mp3',
  '112_시간의 신전 깊은 곳.mp3',
  '113_신들의 황혼.mp3',
  '114_무릉도장 대청.mp3',
  '115_무릉도장.mp3',
  '116_무릉도장.mp3',
  '117_무릉도장.mp3',
  '118_에레브 시작의 숲.mp3',
  '119_에레브.mp3',
  '120_에레브 연무장.mp3',
  '121_변신술사.mp3',
  '122_양떼 목장.mp3',
  '123_마녀의 탑.mp3',
  '124_리엔 얼음 동굴.mp3',
  '125_리엔 차가운 숲.mp3',
  '126_리엔.mp3',
  '127_리엔 수련장.mp3',
  '128_네트의 피라미드.mp3',
  '129_안개 바다의 유령선.mp3',
  '130_커닝 시티 지하철 객차.mp3',
  '131_커닝 스퀘어 로비.mp3',
  '132_커닝 스퀘어.mp3',
  '133_테라 숲.mp3',
];

// URL-encode filenames to handle Korean characters correctly
const TRACKS = TRACK_FILES.map(f => `/background_musics/${encodeURIComponent(f)}`);

function randomIndex() {
  return Math.floor(Math.random() * TRACKS.length);
}

export default function useBGM() {
  const audioRef = useRef(null);
  const [trackIndex, setTrackIndex] = useState(() => randomIndex());
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  // 오디오 엘리먼트 초기화
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = false;
    }
    const audio = audioRef.current;

    audio.src = TRACKS[trackIndex];
    audio.volume = isMuted ? 0 : volume;
    audio.load();

    const handleEnded = () => {
      // 곡이 끝나면 다음 곡으로
      setTrackIndex(prev => (prev + 1) % TRACKS.length);
    };
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [trackIndex]);

  // 볼륨/뮤트 동기화
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // 트랙 변경 시 재생 중이었으면 계속 재생
  useEffect(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.play().catch(() => {});
    }
  }, [trackIndex]);

  const play = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.play().catch(() => {});
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const next = useCallback(() => {
    setTrackIndex(prev => (prev + 1) % TRACKS.length);
  }, []);

  const prev = useCallback(() => {
    setTrackIndex(prev => (prev - 1 + TRACKS.length) % TRACKS.length);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(m => !m);
  }, []);

  const changeVolume = useCallback((val) => {
    setVolume(val);
    if (val > 0) setIsMuted(false);
  }, []);

  // 언마운트 시 정지
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // 파일명에서 숫자 접두사와 확장자를 제거해 표시용 이름 추출
  const trackName = TRACK_FILES[trackIndex]
    .replace(/^\d+_/, '')   // "001_" 형식 숫자 제거
    .replace('.mp3', '');   // 확장자 제거

  return {
    trackName,
    trackIndex,
    volume,
    isMuted,
    isPlaying,
    play,
    pause,
    next,
    prev,
    toggleMute,
    changeVolume,
    totalTracks: TRACKS.length,
  };
}
