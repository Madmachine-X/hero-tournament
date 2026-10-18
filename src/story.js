'use strict';
/* ===== 대화창과 스토리 대본 ===== */
const Dialog = (() => {
  let queue = [], done = null, typing = null, full = '', shown = 0, current = null;
  const pending = [];

  function speaker(who) {
    if (!who || who === 'narr') return SPEAKERS.narr;
    if (SPEAKERS[who]) return SPEAKERS[who];
    if (HEROES[who]) return { id: who, name: who === 'hero' ? G.name : HEROES[who].name, glyph: HEROES[who].glyph, color: HEROES[who].color };
    return SPEAKERS.narr;
  }
  const fill = (s) => String(s).replace(/\{name\}/g, G ? G.name : '무명');

  function play(lines, cb) {
    if (!$('#dialog').hidden) {
      pending.push({ lines: (lines || []).slice(), cb: cb || null });
      return;
    }
    begin(lines, cb);
  }
  function begin(lines, cb) {
    queue = (lines || []).slice();
    done = cb || null;
    $('#dialog').hidden = false;
    next();
  }

  function next() {
    clearInterval(typing); typing = null;
    const box = $('#dialog');
    const line = queue.shift();
    if (!line) {
      box.hidden = true;
      const d = done; done = null; current = null;
      if (d) d();
      if (!$('#dialog').hidden) return;
      if (pending.length) { const p = pending.shift(); begin(p.lines, p.cb); return; }
      setTimeout(() => { if (typeof EventQ !== 'undefined') EventQ.kick(); }, 0);
      return;
    }
    if (line.do) { line.do(); next(); return; }
    const sp = speaker(line.who);
    const face = $('#dlg-face');
    face.hidden = !sp.glyph;
    face.style.setProperty('--c', sp.color);
    const faceImg = $('#dlg-face-img');
    if (faceImg) {
      if (sp.id && HEROES[sp.id]) {
        faceImg.hidden = false;
        faceImg.classList.remove('ok');
        faceImg.onload = () => faceImg.classList.add('ok');
        faceImg.onerror = () => faceImg.classList.remove('ok');
        faceImg.src = `img/portraits/${sp.id}.jpg`;
      } else {
        faceImg.hidden = true;
        faceImg.removeAttribute('src');
        faceImg.classList.remove('ok');
      }
    }
    $('#dlg-glyph').textContent = sp.glyph || '';
    $('#dlg-name').textContent = sp.name || '';
    $('#dlg-name').style.color = sp.color;
    box.classList.toggle('narr', !sp.glyph);
    const choices = $('#dlg-choices');
    choices.innerHTML = '';
    choices.hidden = true;
    $('#dlg-input').hidden = true;
    full = fill(line.text || '');
    shown = 0;
    const txt = $('#dlg-text');
    txt.textContent = '';
    const finishType = () => {
      clearInterval(typing); typing = null; txt.textContent = full;
      if (line.choices) {
        choices.hidden = false;
        choices.innerHTML = line.choices.map((c, i) => `<button class="btn choice" data-i="${i}">${esc(fill(c.label))}</button>`).join('');
        choices.onclick = (e) => {
          const b = e.target.closest('[data-i]');
          if (!b) return;
          const c = line.choices[+b.dataset.i];
          choices.onclick = null;
          if (c.then) queue = c.then.concat(queue);
          if (c.do) c.do();
          next();
        };
      }
      if (line.input) {
        const inp = $('#dlg-input');
        inp.hidden = false;
        const f = $('#dlg-name-in');
        f.value = '';
        setTimeout(() => f.focus(), 30);
        inp.onsubmit = (e) => {
          e.preventDefault();
          const v = f.value.trim().slice(0, 8) || '무명';
          G.name = v;
          inp.onsubmit = null;
          next();
        };
      }
    };
    line._finish = finishType;
    current = line;
    typing = setInterval(() => {
      shown += 2;
      txt.textContent = full.slice(0, shown);
      if (shown >= full.length) finishType();
    }, 22);
  }

  function advance() {
    if ($('#dialog').hidden || !current) return;
    if (typing) { current._finish(); return; }
    if (current.choices || current.input) return;
    next();
  }

  function init() {
    const onAdvanceClick = (e) => {
      if ($('#dialog').hidden) return;
      if (e.target.closest('#dlg-choices') || e.target.closest('#dlg-input')) return;
      if (e.target.closest('#modal') && !$('#modal').hidden) return;
      const storyOn = $('#scr-story') && !$('#scr-story').hidden;
      if (!storyOn && !e.target.closest('#dialog')) return;
      e.preventDefault();
      advance();
    };
    document.addEventListener('click', onAdvanceClick);
    window.addEventListener('keydown', (e) => {
      if ($('#dialog').hidden) return;
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advance(); }
    });
  }
  function active() { return !$('#dialog').hidden; }
  return { init, play, active, advance };
})();

/* ---------- 대본 ---------- */
const SCRIPT = {
  p1: [
    { who: 'narr', text: '검은 강이 소리 없이 흐른다. 물 위에는 셀 수 없는 혼불이 떠 있다.' },
    { who: 'narr', text: '나룻배 한 척이 강 한가운데서 멈춘다.' },
    { who: 'gangrim', text: '또 하나 건너왔군. 이봐, 정신 차려. 이름이 뭐지?', input: true },
    { who: 'gangrim', text: '{name}… 이상하군. 명부 어디에도 그런 이름은 없다.' },
    { who: 'gangrim', text: '뭐, 오늘은 그런 걸 따질 날이 아니지. 따라와. 염라대왕께서 모든 혼을 부르셨다.' },
  ],
  p2: [
    { who: 'narr', text: '저승 십왕청. 단청 기둥 사이로 수천의 혼이 모여 있다. 칼을 찬 자, 왕관을 쓴 자, 깃발을 든 자.' },
    { who: 'yeomra', text: '들어라, 천하의 혼들아.' },
    { who: 'yeomra', text: '저승이 넘친다. 수천 년 쌓인 너희 영웅들의 혼이 윤회의 바퀴를 막아섰다.' },
    { who: 'yeomra', text: '하여 짐이 천하제일 영웅대회를 연다. 업경대에 비친 이승의 땅을 차지하라.' },
    { who: 'yeomra', text: '끝까지 남는 단 하나에게, 소원 하나를 들어주겠다.' },
    { who: 'narr', text: '광장이 함성으로 흔들린다. 그 함성 아래서, 이름 없는 혼들은 아무 말도 하지 않는다.' },
  ],
  p3a: [
    { who: 'bari', text: '명부에 없는 아이야. 놀라지 마. 너를 이 대회에 부른 건 나야.' },
    { who: 'bari', text: '나는 바리. 버려진 공주였고, 지금은 길 잃은 혼을 데려다주는 사람이지.' },
    { who: 'bari', text: '너는 원래 대회에 설 수 없어. 그래서 명부 틈에 자리를 하나 만들어 두었어.' },
    { who: 'bari', text: '업경대 앞에 서렴. 네가 돌아갈 땅을 골라.' },
  ],
  p3b: [
    { who: 'bari', text: '한국. 좋아. 그 땅의 영웅들이 너를 기다릴 거야.' },
    { who: 'bari', text: '강림, 이 아이를 지켜 줘.' },
    { who: 'gangrim', text: '…공주님 부탁이면야. 귀찮게 됐군.' },
  ],
  p4: [
    { who: 'narr', text: '거울 세계 · 서울. 하늘이 갈라지고, 둘은 잿빛 도시 한가운데로 떨어진다.' },
    { who: 'gangrim', text: '온다. 무명혼이다. 이름 잃은 것들은 살아 있는 척하는 걸 미워하지.' },
    { who: 'gangrim', text: '네가 앞장서라. 나는 등 뒤를 맡지.' },
  ],
  eulji: [
    { who: 'narr', text: '싸움이 끝나자, 무너진 산성 위에서 느린 박수 소리가 들린다.' },
    { who: 'eulji', text: '칼 솜씨는 거칠지만 물러서지 않더군. 하나 묻지.' },
    { who: 'eulji', text: '싸우지 않고 이기는 법을 아느냐?', choices: [
      { label: '적이 스스로 지치게 만든다.', then: [{ who: 'eulji', text: '옳다. 수나라 백만 대군도 그렇게 무너졌지. 먼 길을 오게 하고, 굶주리게 하고, 강을 건널 때 친다.' }] },
      { label: '더 많은 병사를 모은다.', then: [{ who: 'eulji', text: '틀렸다. 허나 솔직해서 마음에 든다. 병법은 내가 가르쳐 주지.' }] },
    ] },
    { who: 'eulji', text: '을지문덕이다. 너의 첫 번째 책사가 되어 주마.' },
  ],
  intro: [
    { who: 'narr', text: '업경대 위로 한반도가 떠오른다. 땅은 여러 빛깔로 갈라져 있다.' },
    { who: 'gaesomun', text: '이 땅의 맹주는 하나면 족하다. 평양으로 오너라. 다섯 자루 칼이 기다린다.' },
    { who: 'yusin', text: '삼한은 다시 하나가 되어야 한다. 신라의 이름으로.' },
    { who: 'gyeonhwon', text: '후백제의 한을 풀 때가 왔다. 전주를 넘보는 자는 범에게 물려 죽으리라.' },
    { who: 'gangrim', text: '동쪽 강릉엔 무명혼 떼가, 남쪽 통영 바다엔 망령 수군이 자리를 잡았다.' },
    { who: 'eulji', text: '주요 도시를 차지하면 혼맥을 따라 주변 땅까지 우리 빛으로 물든다. 약한 곳부터 치는 게 병법이다. 강릉이 좋겠군.' },
    { who: 'gangrim', text: '하나 더. 숨겨진 장소는 거리에 떠도는 소문으로만 들린다. 소문 탐색을 시키면 지도에 찍힌다. 낮이든 밤이든 된다.' },
    { who: 'narr', text: '도시를 눌러 정보를 보고, 이웃한 적 도시에 출병하세요. 턴을 넘기면 오전, 오후, 야간이 차례로 지나갑니다. 오전·오후에는 내정과 소문 탐색을, 야간에는 휴식·야간 기습·소문 탐색을 할 수 있습니다. 밤에 아무 일도 하지 않고 턴을 넘기면 남은 장수는 알아서 쉽니다.' },
  ],
  gangneung: [
    { who: 'narr', text: '강릉의 무명혼들이 흩어진다. 마지막 망령이 무릎을 꿇는다.' },
    { who: 'nameless', text: '우리는… 이름이… 있었다…' },
    { who: 'hero', text: '…' },
    { who: 'gangrim', text: '신경 쓰지 마라. 저것들은 원래 그렇게 중얼거린다.' },
    { who: 'narr', text: '망령이 지키던 자리에서 백년 산삼을 얻었다. 강림이 경포 호수 쪽을 오래 바라본다.' },
  ],
  tongyeong: [
    { who: 'narr', text: '통영 앞바다의 망령 수군이 가라앉는다. 안개 너머로 배 한 척이 다가온다.' },
    { who: 'sunsin', text: '바다를 되찾아 주어 고맙소. 이 바다에서 나는 끝까지 싸웠고, 끝까지 남았소.' },
    { who: 'sunsin', text: '그대의 군사들은 물러서지 않더군. 내 활을 빌려주겠소.' },
    { who: 'sunsin', text: '신에게는 아직 열두 척의 배가 남아 있소. 저승에서도 마찬가지요.' },
    { who: 'gangrim', text: '한산도 쪽 안개가 이상하군. 오전에 가 볼 만하겠어. 그리고 지리산 골짜기에 의원이 산다는 소문도 들었다.' },
  ],
  finale: [
    { who: 'narr', text: '한반도 전체가 한 빛으로 물든다. 혼맥이 산과 강을 따라 흐른다.' },
    { who: 'eulji', text: '고향은 하나가 되었다. 이제 바다 건너다.' },
    { who: 'narr', text: '그때, 말을 탄 사신이 업경대 앞에 나타난다.' },
    { who: 'envoy', text: '칭기즈 칸께서 전하신다. 무릎을 꿇든지, 말발굽에 밟히든지 고르라고.' },
    { who: 'bari', text: '시작일 뿐이야, {name}. 그리고… 무명혼들이 너를 보고 있어. 이상하지? 마치 너를 아는 것처럼.' },
  ],
};

/* 보스 패배 후 대사: [항복 대사, 등용 대사, 해방 대사] */
const BOSS_LINES = {
  gyeonhwon: ['호랑이 젖을 먹고 자란 내가… 이름도 없는 자에게 지다니.', '좋다. 범은 더 큰 범을 따르는 법. 백호 월도가 네 앞길을 열 것이다.', '…놓아주겠다고? 이상한 맹주로군. 이 반지를 가져가라. 빚지고는 못 산다.'],
  gaesomun: ['다섯 자루 칼로도 너를 막지 못하는가. 고구려가… 꺾였구나.', '좋다. 내 칼은 이제 네 앞길을 연다. 다만 나는 섬기는 법을 모른다. 함께 싸울 뿐이다.', '대막리지에게 자비라니. 이 빚은 반드시 갚겠다.'],
  yusin: ['삼한을 하나로… 그 꿈을 네가 잇겠다는 건가.', '그렇다면 이 검을 맡기겠다. 삼한이 다시 하나가 될 때까지.', '놓아주는가. 신라의 장수는 은혜를 잊지 않는다.'],
};

/* 숨겨진 장소 이벤트 */
const EVENTS = {
  ev_gamchan: {
    need: () => G.phase === NIGHT ? null : '지금은 별이 보이지 않는다. 야간에 다시 오자.',
    lines: [
      { who: 'narr', text: '관악 기슭. 밤하늘에서 별 하나가 길게 꼬리를 끌며 떨어진다.' },
      { who: 'gamchan', text: '별이 떨어진 날 나는 태어났다. 오늘 또 별이 떨어지니, 새 주인을 만나라는 뜻이겠지.' },
      { who: 'gamchan', text: '고려의 강감찬이다. 거란 십만을 귀주에서 막았다. 그대 깃발 아래 서겠다.' },
    ],
    reward: () => { addHero('gamchan'); return '강감찬이 합류했습니다.'; },
  },
  ev_sejong: {
    need: () => {
      if (ownedCities().length < 3) return '안에서 목소리가 들린다. "나라가 아직 작구나." (도시 3곳 이상 필요)';
      if (G.phase === NIGHT) return '문이 굳게 닫혀 있다. 오전이나 오후에만 열리는 듯하다.';
      return null;
    },
    lines: [
      { who: 'narr', text: '집현전 문이 열려 있다. 촛불 아래 한 사람이 책을 덮는다.' },
      { who: 'sejong', text: '나라가 제법 커졌구나. 그렇다면 글이 필요하겠지. 백성이 쉽게 익혀 날마다 쓰기 편한 글이.' },
      { who: 'sejong', text: '칼보다 붓이 오래 남는다. 내 함께하마.' },
    ],
    reward: () => { addHero('sejong'); return '세종대왕이 합류했습니다.'; },
  },
  ev_sejong_brush: {
    scoutBy: 'sejong',
    after: 'ev_sejong',
    need: () => {
      if (!G.roster.includes('sejong')) return '집현전은 고요하다.';
      if (G.phase !== NIGHT) return '세종대왕이 말한다. "등불이 켜진 야간에 다시 오자. 두고 온 것이 있다."';
      return null;
    },
    lines: [
      { who: 'narr', text: '밤의 집현전. 세종대왕이 서안 위의 붓 한 자루를 집어 든다.' },
      { who: 'sejong', text: '이 붓으로 스물여덟 자를 썼다. 이제 이 글자들이 싸울 차례다.' },
    ],
    reward: () => { giveItem('u_sejong'); return '「어필」을 얻었습니다. 세종대왕에게 장착하면 숨겨진 특수기가 열립니다.'; },
  },
  ev_jeokpae: {
    scoutBy: 'gangrim',
    need: () => {
      if (!G.roster.includes('gangrim')) return '호수는 조용하다.';
      if (G.phase !== NIGHT) return '아직 달이 뜨지 않았다. 야간에 오자.';
      return null;
    },
    lines: [
      { who: 'narr', text: '경포 호수 위로 달이 다섯 개 떠오른다. 그중 하나는 붉다.' },
      { who: 'gangrim', text: '…이건 내 거다. 염라께서 처음 내게 내리신 적패지.' },
      { who: 'gangrim', text: '이름을 적으면 그 혼을 데려간다. 조심해서 쓰지.' },
    ],
    reward: () => { giveItem('u_gangrim'); return '「강림의 적패지」를 얻었습니다. 강림도령에게 장착하세요.'; },
  },
  ev_gyebaek: {
    need: () => G.roster.includes('yusin') ? null : '"나는 신라의 장수를 기다린다." 계백이 등을 돌린다.',
    lines: [
      { who: 'narr', text: '황산벌. 갑옷을 입은 장수가 홀로 서 있다.' },
      { who: 'gyebaek', text: '김유신. 또 만났군. 이번엔 오천이 아니라 나 혼자다.' },
      { who: 'yusin', text: '계백. 그대와 다시 칼을 맞댈 날이 올 줄 알았소.' },
      { who: 'gyebaek', text: '말은 필요 없다. 이겨서 증명해라.' },
    ],
    battle: { title: '황산벌 결투', theme: 'field', enemy: () => ({ heroes: [{ id: 'gyebaek', level: 8, boss: true, recruit: false }], soldiers: 16, level: 6, faction: 'baekje' }) },
    winLines: [{ who: 'gyebaek', text: '…졌다. 하지만 후회는 없다. 이제 그대 곁에서 싸우마.' }],
    reward: () => { addHero('gyebaek'); return '계백이 합류했습니다.'; },
  },
  ev_gildong: {
    need: () => {
      if (G.phase !== NIGHT) return '산채가 비어 있다. 의적들은 야간에 모인다.';
      if (G.gold < 300) return '"빈손으로 왔나?" 300냥이 필요하다.';
      return null;
    },
    lines: [
      { who: 'narr', text: '산채에 횃불이 켜진다. 의적들이 칼을 뽑는다.' },
      { who: 'gildong', text: '관가 냄새가 나는군. 우리 산채엔 무슨 일로?' },
      { who: 'narr', text: '300냥을 내놓자 의적들이 술렁인다.' },
      { who: 'gildong', text: '백성에게 나눌 재물이라… 이런 맹주는 처음이야. 좋아, 홍길동이 함께하지.' },
    ],
    reward: () => { G.gold -= 300; G.karma += 1; addHero('gildong'); return '홍길동이 합류했습니다. (업 +1)'; },
  },
  ev_heojun: {
    need: () => G.keys.includes('k_sansam') ? null : '의원이 고개를 젓는다. "백 년 묵은 약재가 아니면 소용없소."',
    lines: [
      { who: 'narr', text: '지리산 깊은 골짜기, 약초를 말리는 의원이 있다.' },
      { who: 'heojun', text: '백년 산삼이라… 이걸로 저승의 병까지 다스릴 처방을 만들 수 있겠소.' },
      { who: 'heojun', text: '의원은 싸우는 사람이 아니오. 하나 다친 사람을 살리는 일이라면 어디든 가겠소.' },
    ],
    reward: () => { G.keys = G.keys.filter((k) => k !== 'k_sansam'); addHero('heojun'); return '허준이 합류했습니다.'; },
  },
  ev_sunsin_sword: {
    scoutBy: 'sunsin',
    need: () => {
      if (!G.roster.includes('sunsin')) return '바위에 꽂힌 칼은 꿈쩍도 하지 않는다. 주인이 따로 있다.';
      if (G.phase !== 0) return '안개가 걷혀 칼이 보이지 않는다. 오전에 오자.';
      return null;
    },
    lines: [
      { who: 'narr', text: '아침 안개 속 한산도. 바위에 장검 한 자루가 꽂혀 있다.' },
      { who: 'sunsin', text: '삼척서천 산하동색. 석 자 칼로 하늘에 맹세하니 산과 강이 떠는구나.' },
      { who: 'sunsin', text: '이 칼이 다시 내 손에 왔으니, 거북선도 다시 바다로 나갈 것이오.' },
    ],
    reward: () => { giveItem('u_sunsin'); return '「이순신의 장검」을 얻었습니다. 이순신에게 장착하면 「거북선 출격」이 열립니다.'; },
  },
  ev_eulji_fan: {
    scoutBy: 'eulji',
    need: () => G.roster.includes('eulji') ? null : '부채가 물살에 흔들린다. 그 계책을 아는 자가 필요하다.',
    lines: [
      { who: 'narr', text: '살수 강가에 깃부채 하나가 떠밀려 와 있다.' },
      { who: 'eulji', text: '신묘한 계책은 하늘의 이치를 꿰뚫었고, 기묘한 셈은 땅의 이치를 다했노라. 우중문에게 보낸 시가 생각나는군.' },
      { who: 'eulji', text: '이 부채를 들면 강물도 내 편이 된다.' },
    ],
    reward: () => { giveItem('u_eulji'); return '「을지문덕의 깃부채」를 얻었습니다.'; },
  },
  ev_gwang: {
    need: () => {
      if (!G.roster.includes('gaesomun')) return '말발굽 소리만 들린다. 고구려의 장수가 함께해야 한다.';
      if (G.phase !== 0) return '궁터는 조용하다. 오전에 다시 오자.';
      return null;
    },
    lines: [
      { who: 'narr', text: '이른 아침, 무너진 궁터에 말발굽 소리가 울린다. 철갑 기병의 혼들이 줄지어 선다.' },
      { who: 'gaesomun', text: '태왕이시여. 고구려의 칼이 여기 있습니다.' },
      { who: 'gwanggaeto', text: '연개소문인가. 나라가 무너진 뒤에도 칼을 놓지 않았구나.' },
      { who: 'gwanggaeto', text: '좋다. 영락의 깃발을 다시 올리자. 개마무사가 너의 길을 열 것이다.' },
    ],
    reward: () => { addHero('gwanggaeto'); return '광개토대왕이 「호태왕의 철창」을 들고 합류했습니다.'; },
  },
  ev_gamchan_bow: {
    scoutBy: 'gamchan',
    need: () => {
      if (!G.roster.includes('gamchan')) return '별빛이 무언가를 가리키지만, 읽을 줄 아는 장수가 없다.';
      if (G.phase !== NIGHT) return '별이 보이지 않는다. 야간에 오자.';
      return null;
    },
    lines: [
      { who: 'narr', text: '밤의 첨성대. 별빛이 대 아래 한곳으로 모인다.' },
      { who: 'gamchan', text: '별이 가리키는 곳이군. 파 보자.' },
      { who: 'narr', text: '흙 속에서 별빛을 머금은 활이 나온다.' },
      { who: 'gamchan', text: '낙성궁. 이 활이라면 별을 떨어뜨릴 수도 있겠다.' },
    ],
    reward: () => { giveItem('u_gamchan'); return '「낙성궁」을 얻었습니다. 강감찬에게 장착하세요.'; },
  },
};
