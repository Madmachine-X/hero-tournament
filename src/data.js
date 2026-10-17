'use strict';
/* ===== 게임 데이터: 시간대, 세력, 영웅, 스킬, 장비, 도시, 숨겨진 장소 ===== */

/* 하루는 오전 → 오후 → 야간. 오전·오후는 내정, 야간은 휴식·기습·소문 탐색 */
const PHASES = [
  { id: 'morning', name: '오전', day: true },
  { id: 'noon', name: '오후', day: true },
  { id: 'night', name: '야간', day: false },
];
const NIGHT = 2;

const FACTIONS = {
  player:   { name: '맹주',         color: '#7fd3e6', glyph: '魂' },
  goguryeo: { name: '연개소문 세력', color: '#c8323c', glyph: '麗' },
  baekje:   { name: '견훤 세력',     color: '#e0812f', glyph: '百' },
  silla:    { name: '김유신 세력',   color: '#d2ad3c', glyph: '羅' },
  ghost:    { name: '무명혼',        color: '#8b95a6', glyph: '亡' },
  sea:      { name: '바다 망령',     color: '#5a7cc0', glyph: '水' },
};

/* 영웅: stats = 무력 str, 통솔 lea, 지력 int, 민첩 agi, 체력 vit */
const HEROES = {
  hero:       { name: '무명', title: '이름 없는 혼', glyph: '魂', color: '#7fd3e6', era: '저승',
                stats: { str: 13, lea: 12, int: 13, agi: 14, vit: 14 }, unit: 'melee', skill: 'honbul', hidden: null, weapon: null,
                bio: '저승 명부에 이름이 없는 혼. 바리공주가 명부 틈에 자리를 만들어 대회에 세웠다.' },
  gangrim:    { name: '강림도령', title: '저승차사', glyph: '冥', color: '#c4bba8', era: '저승 설화',
                stats: { str: 15, lea: 10, int: 13, agi: 16, vit: 13 }, unit: 'melee', skill: 'orat', hidden: 'jeokpae', weapon: 'u_gangrim',
                bio: '염라대왕의 명으로 산 자를 데려가는 저승차사. 투덜대지만 한번 맡은 일은 끝까지 한다.' },
  eulji:      { name: '을지문덕', title: '살수의 지장', glyph: '乙', color: '#5aa7d6', era: '고구려',
                stats: { str: 11, lea: 18, int: 20, agi: 12, vit: 12 }, unit: 'archer', skill: 'cheongcheon', hidden: 'salsu', weapon: 'u_eulji',
                bio: '고구려의 장수. 수나라 대군을 깊이 끌어들여 지치게 한 뒤 살수에서 무너뜨렸다.' },
  sunsin:     { name: '이순신', title: '바다의 수호자', glyph: '舜', color: '#e8603f', era: '조선',
                stats: { str: 16, lea: 20, int: 17, agi: 12, vit: 16 }, unit: 'archer', skill: 'hakik', hidden: 'geobuk', weapon: 'u_sunsin',
                bio: '조선 수군의 통제사. 남은 배 열두 척으로 바다를 지켜 냈다.' },
  sejong:     { name: '세종대왕', title: '글의 성군', glyph: '世', color: '#e8c050', era: '조선',
                stats: { str: 8, lea: 15, int: 22, agi: 10, vit: 12 }, unit: 'archer', skill: 'hunmin', hidden: 'banpo', weapon: 'u_sejong',
                bio: '조선의 임금. 백성이 쉽게 익혀 쓸 수 있도록 훈민정음을 만들었다.' },
  gwanggaeto: { name: '광개토대왕', title: '정복의 태왕', glyph: '廣', color: '#a07ce6', era: '고구려',
                stats: { str: 20, lea: 19, int: 13, agi: 15, vit: 18 }, unit: 'cavalry', skill: 'gaema', hidden: 'musa', weapon: 'u_gwang',
                bio: '고구려의 태왕. 철갑 기병 개마무사를 이끌고 영토를 크게 넓혔다.' },
  gamchan:    { name: '강감찬', title: '낙성의 장군', glyph: '姜', color: '#8cbcff', era: '고려',
                stats: { str: 13, lea: 18, int: 19, agi: 12, vit: 13 }, unit: 'archer', skill: 'hwasal', hidden: 'nakseong', weapon: 'u_gamchan',
                bio: '고려의 장군. 별이 떨어진 날 태어났다는 전설이 있다. 귀주에서 거란군을 크게 물리쳤다.' },
  yusin:      { name: '김유신', title: '삼한의 검', glyph: '庾', color: '#c896e2', era: '신라',
                stats: { str: 19, lea: 18, int: 15, agi: 14, vit: 16 }, unit: 'melee', skill: 'geomgi', hidden: 'samhan', weapon: 'u_yusin',
                bio: '신라의 장군. 삼국 통일 전쟁을 이끌었다.' },
  gaesomun:   { name: '연개소문', title: '다섯 칼의 대막리지', glyph: '淵', color: '#d0383f', era: '고구려',
                stats: { str: 20, lea: 17, int: 13, agi: 16, vit: 17 }, unit: 'melee', skill: 'odo', hidden: 'bigeom', weapon: 'u_gaesomun',
                bio: '고구려의 대막리지. 몸에 칼 다섯 자루를 차고 다녔다고 전한다.' },
  gyeonhwon:  { name: '견훤', title: '호랑이 젖의 왕', glyph: '甄', color: '#e8893a', era: '후백제',
                stats: { str: 19, lea: 16, int: 12, agi: 15, vit: 18 }, unit: 'melee', skill: 'maengho', hidden: 'baekho', weapon: 'u_gyeonhwon',
                bio: '후백제를 세운 왕. 갓난아기 때 호랑이가 젖을 먹였다는 전설이 있다.' },
  heojun:     { name: '허준', title: '동의보감의 의원', glyph: '許', color: '#72d394', era: '조선',
                stats: { str: 8, lea: 10, int: 20, agi: 12, vit: 13 }, unit: 'melee', skill: 'donguibogam', hidden: 'guguep', weapon: 'u_heojun',
                bio: '조선의 의원. 동의보감을 지어 백성의 병을 다스렸다.' },
  gyebaek:    { name: '계백', title: '황산벌의 결사', glyph: '階', color: '#aeb4bc', era: '백제',
                stats: { str: 18, lea: 17, int: 11, agi: 13, vit: 19 }, unit: 'melee', skill: 'gyeolsa', hidden: 'ochon', weapon: 'u_gyebaek',
                bio: '백제의 장군. 오천 결사대로 황산벌에서 신라의 대군에 맞섰다.' },
  gildong:    { name: '홍길동', title: '활빈당 두령', glyph: '洪', color: '#3fc6a8', era: '고전소설',
                stats: { str: 15, lea: 10, int: 15, agi: 22, vit: 12 }, unit: 'melee', skill: 'chukji', hidden: 'bunsin', weapon: 'u_gildong',
                bio: '고전소설 속 의적. 축지법과 분신술로 탐관오리를 혼내고 재물을 백성에게 나눴다.' },
};
const HERO_ORDER = ['hero','gangrim','eulji','sunsin','sejong','gwanggaeto','gamchan','yusin','gaesomun','gyeonhwon','heojun','gyebaek','gildong'];

/* 스킬. ai: aoe(무리), target(단일), heal, buff, global(전장), self */
const SKILLS = {
  honbul:      { name: '혼불', cd: 7, ai: 'target', desc: '푸른 혼불 세 개를 날려 가까운 적을 태운다.' },
  orat:        { name: '저승 오랏줄', cd: 9, ai: 'target', desc: '오랏줄로 적 하나를 묶어 끌어오고 3초간 기절시킨다.' },
  jeokpae:     { name: '적패지 낙인', cd: 22, ai: 'aoe', desc: '염라의 붉은 패를 찍어 주변 적 모두를 6초간 태우고 느리게 한다.' },
  cheongcheon: { name: '청천강 물살', cd: 8, ai: 'aoe', desc: '앞쪽 부채꼴로 물살을 일으켜 적을 밀어내고 느리게 한다.' },
  salsu:       { name: '살수대첩', cd: 30, ai: 'global', desc: '둑을 터뜨려 전장 전체를 휩쓰는 물결을 일으킨다. 휩쓸린 적은 쓰러진다.' },
  hakik:       { name: '학익진', cd: 9, ai: 'aoe', desc: '학의 날개처럼 펼친 두 줄 화살이 적 무리를 감싸며 쏟아진다.' },
  geobuk:      { name: '거북선 출격', cd: 32, ai: 'global', desc: '거북선이 전장을 가로지르며 좌우로 포를 쏘고 용머리에서 불을 뿜는다.' },
  hunmin:      { name: '훈민정음', cd: 10, ai: 'aoe', desc: '한글 자모가 사방으로 터져 나가 맞은 적을 2초간 기절시킨다.' },
  banpo:       { name: '만백성의 글', cd: 32, ai: 'global', desc: '하늘에서 훈민정음 글자가 전장의 모든 적에게 쏟아져 3.5초간 기절시킨다.' },
  gaema:       { name: '개마돌격', cd: 8, ai: 'target', desc: '적진을 향해 일직선으로 돌진하며 길 위의 적을 쓸어버린다.' },
  musa:        { name: '개마무사 진격', cd: 30, ai: 'global', desc: '철갑 기병대의 혼령을 불러 전장을 가로질러 돌격시킨다.' },
  hwasal:      { name: '귀주 화살비', cd: 9, ai: 'aoe', desc: '적 무리 위로 2초 동안 화살비를 쏟는다.' },
  nakseong:    { name: '낙성', cd: 30, ai: 'global', desc: '별을 떨어뜨린다. 유성 일곱 개가 적장을 노리고 떨어진다.' },
  geomgi:      { name: '화랑 검기', cd: 7, ai: 'target', desc: '초승달 모양 검기를 날려 일직선 위의 적을 모두 벤다.' },
  samhan:      { name: '삼한일통', cd: 28, ai: 'aoe', desc: '세 갈래 거대한 검기로 앞의 모든 것을 가른다.' },
  odo:         { name: '오도난무', cd: 9, ai: 'aoe', desc: '칼 다섯 자루가 몸 주위를 3초 동안 휘돈다.' },
  bigeom:      { name: '비검 오월', cd: 26, ai: 'global', desc: '다섯 자루 칼이 날아가 각기 다른 적을 세 번씩 벤다.' },
  maengho:     { name: '맹호 포효', cd: 10, ai: 'aoe', desc: '호랑이처럼 포효해 주변 적을 2.5초간 공포에 빠뜨린다.' },
  baekho:      { name: '백호 강림', cd: 30, ai: 'global', desc: '거대한 백호를 불러 8초 동안 적진을 덮치게 한다.' },
  donguibogam: { name: '동의보감 처방', cd: 10, ai: 'heal', desc: '주변 아군의 체력을 30% 회복하고 기절을 풀어 준다.' },
  guguep:      { name: '구급 회생', cd: 40, ai: 'revive', desc: '모든 아군을 완전히 회복하고 쓰러진 영웅을 일으킨다.' },
  gyeolsa:     { name: '결사', cd: 12, ai: 'buff', desc: '주변 아군의 공격력 40%, 방어력 30%를 8초간 올린다.' },
  ochon:       { name: '오천 결사대', cd: 34, ai: 'global', desc: '결사대 혼령 열둘을 불러내고 모든 아군을 고무한다.' },
  chukji:      { name: '축지법', cd: 6, ai: 'target', desc: '순식간에 적장 뒤로 이동해 강하게 벤다.' },
  bunsin:      { name: '분신술', cd: 28, ai: 'global', desc: '분신 넷을 만들어 10초 동안 함께 싸운다.' },
  gyeokryeo:   { name: '격려', cd: 12, ai: 'buff', desc: '주변 병사를 격려해 사기를 올리고 잠시 공격력을 높인다.' },
  /* 적 장수 전용 */
  ghostfire:   { name: '귀화', cd: 9, ai: 'target', desc: '' },
  tide:        { name: '망령의 해일', cd: 11, ai: 'aoe', desc: '' },
};

/* 장비. hands: 1 한손, 2 양손, 'off' 보조(방패) */
const ITEMS = {
  w_hwando:   { name: '환도', slot: 'weapon', wtype: 'sword', hands: 1, atk: 8, price: 120, desc: '조선 군사가 차던 기본 칼.' },
  w_ungeom:   { name: '운검', slot: 'weapon', wtype: 'sword', hands: 1, atk: 14, agi: 2, price: 320, desc: '임금을 호위하던 별운검의 칼.' },
  w_bisu:     { name: '비수', slot: 'weapon', wtype: 'dagger', hands: 1, atk: 6, agi: 4, price: 100, desc: '소매에 숨기는 짧은 칼. 쌍무기로 쓰기 좋다.' },
  w_jangchang:{ name: '장창', slot: 'weapon', wtype: 'spear', hands: 2, atk: 18, price: 240, desc: '긴 창. 양손으로 쥔다.' },
  w_woldo:    { name: '월도', slot: 'weapon', wtype: 'glaive', hands: 2, atk: 23, price: 330, desc: '초승달 날의 언월도. 양손무기.' },
  w_gakgung:  { name: '각궁', slot: 'weapon', wtype: 'bow', hands: 2, atk: 12, price: 220, desc: '물소 뿔로 만든 활. 장착하면 원거리 공격.' },
  w_heukgak:  { name: '흑각궁', slot: 'weapon', wtype: 'bow', hands: 2, atk: 19, agi: 2, price: 440, desc: '검은 물소 뿔 활. 사거리가 길고 힘이 세다.' },
  w_deungpae: { name: '등패', slot: 'weapon', wtype: 'shield', hands: 'off', def: 8, price: 120, desc: '등나무로 엮은 방패. 보조 무기 칸에 든다.' },
  w_wonbang:  { name: '원방패', slot: 'weapon', wtype: 'shield', hands: 'off', def: 14, hp: 30, price: 300, desc: '쇠를 덧댄 둥근 방패.' },
  w_hakuseon: { name: '학우선', slot: 'weapon', wtype: 'fan', hands: 1, int: 6, atk: 3, price: 200, desc: '학 깃으로 만든 부채. 책사의 무기.' },

  u_sunsin:   { name: '이순신의 장검', slot: 'weapon', wtype: 'sword', hands: 2, atk: 30, def: 4, owner: 'sunsin', unique: true,
                desc: '"三尺誓天 山河動色" 석 자 칼로 하늘에 맹세하니 산과 강이 떤다.' },
  u_sejong:   { name: '어필', slot: 'weapon', wtype: 'brush', hands: 1, int: 18, atk: 6, owner: 'sejong', unique: true,
                desc: '임금의 붓. 스물여덟 자가 이 붓끝에서 나왔다.' },
  u_eulji:    { name: '을지문덕의 깃부채', slot: 'weapon', wtype: 'fan', hands: 1, int: 14, atk: 6, owner: 'eulji', unique: true,
                desc: '적장에게 시를 보내 조롱하던 그 손의 부채.' },
  u_gwang:    { name: '호태왕의 철창', slot: 'weapon', wtype: 'spear', hands: 2, atk: 30, hp: 60, owner: 'gwanggaeto', unique: true,
                desc: '영락 태왕이 개마무사 앞에서 들던 철창.' },
  u_gamchan:  { name: '낙성궁', slot: 'weapon', wtype: 'bow', hands: 2, atk: 24, int: 8, owner: 'gamchan', unique: true,
                desc: '별빛을 머금은 활. 첨성대 아래 묻혀 있었다.' },
  u_yusin:    { name: '김유신의 보검', slot: 'weapon', wtype: 'sword', hands: 1, atk: 22, agi: 4, owner: 'yusin', unique: true,
                desc: '하늘에 빌어 신령한 기운을 받았다는 칼.' },
  u_gaesomun: { name: '다섯 자루 칼', slot: 'weapon', wtype: 'sword', hands: 1, atk: 20, agi: 6, owner: 'gaesomun', unique: true,
                desc: '대막리지가 몸에 지니던 다섯 칼 가운데 으뜸.' },
  u_gyeonhwon:{ name: '백호 월도', slot: 'weapon', wtype: 'glaive', hands: 2, atk: 32, owner: 'gyeonhwon', unique: true,
                desc: '흰 범의 이빨을 본뜬 커다란 월도.' },
  u_heojun:   { name: '허준의 금침', slot: 'weapon', wtype: 'dagger', hands: 1, int: 16, atk: 4, owner: 'heojun', unique: true,
                desc: '죽어 가는 사람도 일으켰다는 금빛 침.' },
  u_gyebaek:  { name: '황산벌의 칼', slot: 'weapon', wtype: 'sword', hands: 1, atk: 20, def: 6, owner: 'gyebaek', unique: true,
                desc: '오천 결사대를 이끌던 칼. 날이 많이 상했다.' },
  u_gildong:  { name: '홍길동의 단도', slot: 'weapon', wtype: 'dagger', hands: 1, atk: 16, agi: 10, owner: 'gildong', unique: true,
                desc: '활빈당 두령의 단도. 손잡이에 부적이 감겨 있다.' },
  u_gangrim:  { name: '강림의 적패지', slot: 'weapon', wtype: 'talisman', hands: 1, int: 12, atk: 8, owner: 'gangrim', unique: true,
                desc: '염라대왕이 내린 붉은 패. 이름을 적으면 그 혼을 데려간다.' },

  a_dopo:     { name: '무명 도포', slot: 'armor', def: 3, int: 4, price: 80, desc: '무명천으로 지은 도포.' },
  a_chalgap:  { name: '찰갑', slot: 'armor', def: 10, price: 200, desc: '작은 쇳조각을 엮은 갑옷.' },
  a_dujeong:  { name: '두정갑', slot: 'armor', def: 16, hp: 40, price: 380, desc: '안쪽에 철판을 대고 못을 박은 갑옷.' },
  a_suui:     { name: '저승 수의', slot: 'armor', def: 7, int: 8, hp: 20, price: 300, desc: '저승의 실로 지은 옷. 혼의 힘을 키운다.' },
  a_yongrin:  { name: '용린갑', slot: 'armor', def: 24, hp: 80, price: 900, desc: '용의 비늘처럼 겹친 갑옷.' },

  r_ok:       { name: '옥가락지', slot: 'acc', kind: '반지', hp: 25, price: 90, desc: '푸른 옥으로 깎은 가락지.' },
  r_eun:      { name: '은가락지', slot: 'acc', kind: '반지', atk: 4, price: 110, desc: '액운을 막는다는 은가락지.' },
  r_honbul:   { name: '혼불 반지', slot: 'acc', kind: '반지', int: 5, price: 140, desc: '작은 혼불이 갇힌 반지.' },
  n_hobak:    { name: '호박 목걸이', slot: 'acc', kind: '목걸이', def: 4, hp: 15, price: 120, desc: '호박 구슬을 꿴 목걸이.' },
  n_hobal:    { name: '범 발톱 목걸이', slot: 'acc', kind: '목걸이', atk: 6, price: 180, desc: '범의 발톱을 꿴 목걸이.' },
  n_yeomju:   { name: '백팔 염주', slot: 'acc', kind: '목걸이', cdr: 8, price: 220, desc: '기술의 재사용 시간을 줄인다.' },
  b_norigae:  { name: '삼작노리개', slot: 'acc', kind: '노리개', agi: 3, hp: 15, price: 150, desc: '세 갈래 술이 달린 노리개.' },
  b_bujeok:   { name: '벽사 부적', slot: 'acc', kind: '부적', cdr: 5, int: 3, price: 130, desc: '나쁜 기운을 막는 부적.' },
  r_sinui:    { name: '맹주의 신의', slot: 'acc', kind: '반지', atk: 5, def: 5, hp: 30, desc: '놓아준 영웅이 남긴 반지.' },

  k_sansam:   { name: '백년 산삼', slot: 'key', desc: '강릉의 망령이 지키던 산삼. 이름난 의원이 탐낼 만하다.' },
  /* 야간 비밀 장터에만 나오는 물건 */
  m_gamtu:    { name: '도깨비 감투', slot: 'acc', kind: '부적', agi: 6, cdr: 6, price: 480, market: true, desc: '쓰면 모습이 흐려진다는 도깨비의 감투. 비밀 장터에서만 판다.' },
  m_yeouiju:  { name: '여의주 조각', slot: 'acc', kind: '목걸이', int: 10, hp: 30, price: 560, market: true, desc: '이무기가 놓친 여의주의 한 조각. 비밀 장터에서만 판다.' },
  m_gatkkeun: { name: '저승사자 갓끈', slot: 'acc', kind: '노리개', atk: 8, agi: 3, price: 520, market: true, desc: '저승사자가 잃어버린 갓끈. 비밀 장터에서만 판다.' },
  m_heukdo:   { name: '흑운도', slot: 'weapon', wtype: 'sword', hands: 1, atk: 19, agi: 4, price: 640, market: true, desc: '달빛을 먹는 검은 칼. 비밀 장터에서만 판다.' },
};
/* 내정 명령: 영웅 한 명이 턴마다 하나를 한다 */
const COMMANDS = {
  agri:  { name: '개간', key: 'agri', label: '농업', cost: { gold: 50 }, desc: '논밭을 넓혀 농업을 올린다. 매일 아침 들어오는 군량이 는다.', stat: '지력·통솔', when: 'day' },
  comm:  { name: '상업', key: 'comm', label: '상업', cost: { gold: 50 }, desc: '시장을 키워 상업을 올린다. 매일 아침 들어오는 금이 는다.', stat: '지력', when: 'day' },
  wall:  { name: '성벽', key: 'wall', label: '성벽', cost: { gold: 60 }, desc: '성벽을 보수한다. 이 도시를 지킬 때 방어력이 오른다.', stat: '통솔·무력', when: 'day' },
  loyal: { name: '선정', key: 'loyal', label: '민심', cost: { food: 40 }, desc: '곡식을 풀어 민심을 얻는다. 민심은 세금과 징병에 영향을 준다.', stat: '지력', when: 'day' },
  draft: { name: '징병', key: 'troops', label: '병력', cost: { goldPer: 1.5 }, desc: '혼불 병사를 모은다. 민심이 조금 떨어지고 훈련도가 묽어진다.', stat: '통솔', when: 'day' },
  train: { name: '훈련', key: 'train', label: '훈련', cost: { food: 20 }, desc: '병사를 조련한다. 훈련도가 높을수록 병사가 강하고 사기도 높다.', stat: '무력·통솔', when: 'day' },
  move:  { name: '수송', key: 'troops', label: '병력', cost: {}, desc: '이웃한 아군 도시로 병력을 옮긴다.', stat: '', when: 'day' },
  rest:  { name: '휴식', key: null, label: '', cost: {}, desc: '밤새 쉬며 체력을 모두 회복한다. 쉬지 않고 움직인 장수는 다음날 능력치가 20% 떨어진다.', stat: '', when: 'night' },
  scout: { name: '소문 탐색', key: null, label: '', cost: {}, desc: '어둠을 틈타 주막과 장터를 돌며 소문을 모은다. 숨겨진 장소, 적의 형편, 떨어진 재물, 비밀 장터 소식을 얻을 수 있다.', stat: '지력', when: 'night' },
  search: { name: '인재 탐색', key: null, label: '', cost: { gold: 30 }, desc: '고을을 돌며 이름 없는 문관·무관의 혼을 찾는다. 찾으면 이 도시에 합류한다.', stat: '지력', when: 'day' },
  relocate: { name: '이동', key: null, label: '', cost: {}, desc: '영웅을 다른 아군 도시로 보낸다. 이웃은 1턴, 길이 멀수록 그 칸 수만큼 턴을 쓴다. 밤길에도 갈 수 있다.', stat: '', when: 'any' },
};

/* 진형: 출진 전에 고른다 */
const FORMATIONS = {
  hakik:   { name: '학익진', hanja: '鶴翼', desc: '학이 날개를 펴듯 감싼다. 측면·배후 공격 피해가 더 크게 들어가지만 방어가 조금 약하다.', flank: 1.6, def: 0.9 },
  eorin:   { name: '어린진', hanja: '魚鱗', desc: '물고기 비늘처럼 겹쳐 정면을 뚫는다. 처음 20초 동안 공격 +25%, 이동 +10%.', openAtk: 1.25, spd: 1.1 },
  bangwon: { name: '방원진', hanja: '方圓', desc: '둥글게 모여 버틴다. 방어 +25%, 사기가 덜 꺾이지만 느리다.', def: 1.25, moraleLoss: 0.6, spd: 0.85 },
  jangsa:  { name: '장사진', hanja: '長蛇', desc: '긴 뱀처럼 넓게 늘어서 빠르게 움직인다. 이동 +20%, 활 공격 +20%.', spd: 1.2, ranged: 1.2 },
};
const FACTION_FORMATION = { goguryeo: 'eorin', silla: 'hakik', baekje: 'eorin', ghost: 'bangwon', sea: 'jangsa', player: 'eorin' };

const STAT_LABEL = { atk: '공격', def: '방어', hp: '체력', int: '지력', agi: '민첩', cdr: '재사용 감소%' };
const WTYPE_LABEL = { sword: '검', dagger: '단도', spear: '창', glaive: '월도', bow: '활', shield: '방패', fan: '부채', brush: '붓', talisman: '부적' };

/* 영웅이 합류할 때 들고 오는 장비 */
const HERO_GEAR = {
  hero:       { w1: 'w_hwando', armor: 'a_dopo' },
  gangrim:    { w1: 'w_hwando', armor: 'a_dopo' },
  eulji:      { w1: 'w_gakgung', armor: 'a_dopo' },
  sunsin:     { w1: 'w_gakgung', armor: 'a_chalgap' },
  sejong:     { w1: 'w_gakgung', armor: 'a_dopo' },
  gwanggaeto: { w1: 'u_gwang', armor: 'a_chalgap' },
  gamchan:    { w1: 'w_gakgung', armor: 'a_chalgap' },
  yusin:      { w1: 'u_yusin', w2: 'w_deungpae', armor: 'a_chalgap' },
  gaesomun:   { w1: 'u_gaesomun', w2: 'w_hwando', armor: 'a_chalgap' },
  gyeonhwon:  { w1: 'u_gyeonhwon', armor: 'a_chalgap' },
  heojun:     { w1: 'u_heojun', armor: 'a_dopo' },
  gyebaek:    { w1: 'u_gyebaek', w2: 'w_deungpae', armor: 'a_chalgap' },
  gildong:    { w1: 'u_gildong', w2: 'w_bisu', armor: 'a_dopo' },
};

/* 도시 (현재 지도 좌표) */
const CITIES = {
  seoul:     { name: '서울', hanja: '漢陽', lon: 126.98, lat: 37.57, owner: 'player', agri: 45, comm: 50, wall: 55, loyal: 65, troops: 160, train: 45, level: 1,
               shop: ['w_hwando','w_bisu','w_jangchang','w_gakgung','w_deungpae','a_dopo','a_chalgap','r_ok','r_eun','n_hobak'] },
  pyongyang: { name: '평양', hanja: '平壤', lon: 125.75, lat: 39.03, owner: 'goguryeo', agri: 50, comm: 40, wall: 70, loyal: 60, troops: 220, train: 60, level: 5,
               boss: 'gaesomun', captains: ['고구려 망령장', '고구려 망령장'], theme: 'north',
               shop: ['w_woldo','w_heukgak','a_dujeong','n_hobal'] },
  gangneung: { name: '강릉', hanja: '江陵', lon: 128.9, lat: 37.75, owner: 'ghost', agri: 30, comm: 25, wall: 35, loyal: 40, troops: 100, train: 30, level: 2,
               bossGeneric: '무명 천부장', bossSkill: 'ghostfire', captains: ['무명 백부장'], theme: 'mist',
               shop: ['r_honbul','b_bujeok'] },
  jeonju:    { name: '전주', hanja: '全州', lon: 127.15, lat: 35.82, owner: 'baekje', agri: 55, comm: 40, wall: 50, loyal: 55, troops: 160, train: 45, level: 3,
               boss: 'gyeonhwon', captains: ['후백제 망령장'], theme: 'field',
               shop: ['w_ungeom','w_wonbang','b_norigae','r_honbul'] },
  gyeongju:  { name: '경주', hanja: '慶州', lon: 129.22, lat: 35.86, owner: 'silla', agri: 45, comm: 55, wall: 65, loyal: 60, troops: 220, train: 60, level: 5,
               boss: 'yusin', captains: ['신라 망령장', '화랑 망령'], theme: 'field',
               shop: ['w_hakuseon','a_suui','n_yeomju','b_bujeok'] },
  tongyeong: { name: '통영', hanja: '統營', lon: 128.43, lat: 34.85, owner: 'sea', agri: 30, comm: 45, wall: 40, loyal: 45, troops: 140, train: 40, level: 3,
               bossGeneric: '수귀 대장', bossSkill: 'tide', captains: ['망령 수군장'], theme: 'coast',
               shop: ['w_heukgak','a_dujeong'] },
};
const ROADS = [
  ['seoul','pyongyang'], ['seoul','gangneung'], ['seoul','jeonju'], ['pyongyang','gangneung'],
  ['gangneung','gyeongju'], ['jeonju','gyeongju'], ['jeonju','tongyeong'], ['gyeongju','tongyeong'],
];

/* 숨겨진 장소. region 도시를 차지해야 탐색할 수 있다. */
const PLACES = {
  nakseongdae: { name: '낙성대', lon: 126.62, lat: 37.30, region: 'seoul',
                 hint: '밤이 되면 관악 기슭에 별이 떨어진다는 소문이 있다.', events: ['ev_gamchan'] },
  jiphyeon:    { name: '집현전', lon: 127.30, lat: 37.86, region: 'seoul',
                 hint: '궁궐 깊은 곳에서 글 읽는 소리가 들린다. 나라가 커지면 오전·오후에 문이 열린다고 한다.', events: ['ev_sejong', 'ev_sejong_brush'] },
  gyeongpo:    { name: '경포대', lon: 128.62, lat: 38.05, region: 'gangneung',
                 hint: '밤이 깊어 달이 뜨면 경포 호수에 달이 다섯 개 뜬다. 저승의 일을 아는 자가 함께 가야 보인다.', events: ['ev_jeokpae'] },
  hwangsan:    { name: '황산벌', lon: 127.10, lat: 36.22, region: 'jeonju',
                 hint: '황산벌에 아직 칼을 놓지 못한 장수가 있다. 그는 오래된 적수를 기다린다.', events: ['ev_gyebaek'] },
  hwalbin:     { name: '활빈당 산채', lon: 126.72, lat: 35.30, region: 'jeonju',
                 hint: '밤마다 의적들이 모인다. 백성에게 나눌 재물 300냥을 가져가면 두령을 만날 수 있다.', events: ['ev_gildong'] },
  jirisan:     { name: '지리산 약초골', lon: 127.73, lat: 35.34, region: 'tongyeong',
                 hint: '산골 의원이 귀한 약재를 찾는다. 백 년 묵은 약초라면 그를 움직일 수 있다.', events: ['ev_heojun'] },
  hansan:      { name: '한산도', lon: 128.62, lat: 34.62, region: 'tongyeong',
                 hint: '오전 바다 안개 속 한산도 바위에 칼 한 자루가 꽂혀 있다. 주인만 뽑을 수 있다.', events: ['ev_sunsin_sword'] },
  salsu:       { name: '살수', lon: 125.62, lat: 39.62, region: 'pyongyang',
                 hint: '살수 강가에 깃부채 하나가 떠밀려 와 있다. 그 계책을 아는 장수를 기다린다.', events: ['ev_eulji_fan'] },
  anhak:       { name: '안학궁 터', lon: 126.10, lat: 39.30, region: 'pyongyang',
                 hint: '이른 오전마다 무너진 궁터에 말발굽 소리가 울린다. 고구려의 대막리지가 함께라면 태왕이 응답할지 모른다.', events: ['ev_gwang'] },
  cheomseong:  { name: '첨성대', lon: 128.92, lat: 35.55, region: 'gyeongju',
                 hint: '별을 보던 대 아래 무언가 묻혀 있다. 별과 인연이 있는 장수가 밤에 찾아야 한다.', events: ['ev_gamchan_bow'] },
};

const CITY_REVEALS = {
  gangneung: ['gyeongpo'], jeonju: ['hwangsan', 'hwalbin'], tongyeong: ['hansan', 'jirisan'],
  pyongyang: ['salsu', 'anhak'], gyeongju: ['cheomseong'],
};

const SPEAKERS = {
  narr:     { name: '', glyph: '', color: '#a59d8a' },
  yeomra:   { name: '염라대왕', glyph: '閻', color: '#e0503c' },
  bari:     { name: '바리공주', glyph: '花', color: '#e2d4ff' },
  nameless: { name: '무명혼', glyph: '亡', color: '#8b95a6' },
  envoy:    { name: '몽골 사신', glyph: '蒙', color: '#c49a5c' },
};
