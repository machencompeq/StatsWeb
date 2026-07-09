/* StatGrade AI — 共用導覽與身分邏輯
   每頁的 <header class="nav"> 內需有 #navLinks 與 #navAuth 容器；
   login.html 使用精簡導覽（無此二容器）時自動跳過。 */
(function () {
  var role = localStorage.getItem('authRole');
  var user = localStorage.getItem('authUser');
  /* demo 帳號顯示名固定；已登入的舊 session 一併更新 */
  var DEMO_NAMES = { student: '陳小涵', teacher: '朱珊瑩' };
  if (user && DEMO_NAMES[user] && localStorage.getItem('authName') !== DEMO_NAMES[user]) {
    localStorage.setItem('authName', DEMO_NAMES[user]);
  }
  var name = localStorage.getItem('authName') || user || '';
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  var LINKS = {
    guest:   [['index.html', '主頁'], ['intro.html', '系統介紹']],
    student: [['index.html', '主頁'], ['intro.html', '系統介紹'], ['student.html', '作答區']],
    teacher: [['index.html', '主頁'], ['intro.html', '系統介紹'], ['teacher.html', '教師儀表板']]
  };
  var links = LINKS[role] || LINKS.guest;

  var navLinks = document.getElementById('navLinks');
  if (navLinks) {
    navLinks.innerHTML = links.map(function (l) {
      var active = page === l[0] ? ' is-active' : '';
      return '<a class="nav__link' + active + '" href="' + l[0] + '">' + l[1] + '</a>';
    }).join('');
  }

  var navAuth = document.getElementById('navAuth');
  if (navAuth) {
    if (role) {
      var chipClass = role === 'teacher' ? 'chip--role-teacher' : 'chip--role-student';
      var chipText = role === 'teacher' ? '教師' : '學生';
      var avatarClass = role === 'teacher' ? 'nav__avatar nav__avatar--teacher' : 'nav__avatar';
      navAuth.innerHTML =
        '<span class="chip ' + chipClass + '">' + chipText + '</span>' +
        '<a class="nav__userwrap" href="profile.html" title="個人資料">' +
          '<span class="' + avatarClass + '">' + name.charAt(0) + '</span>' +
          '<span class="nav__user">' + name + '</span>' +
        '</a>' +
        '<button class="btn btn--ghost btn--sm" type="button" id="navLogout">登出</button>';
      document.getElementById('navLogout').addEventListener('click', function () {
        window.sgLogout();
      });
    } else {
      navAuth.innerHTML = '<a class="btn btn--primary btn--sm" href="login.html">登入</a>';
    }
  }

  var toggle = document.querySelector('.nav__toggle');
  if (toggle && navLinks) {
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      document.querySelector('.nav').classList.toggle('is-open');
    });
  }

  window.sgLogout = function () {
    localStorage.removeItem('authRole');
    localStorage.removeItem('authUser');
    localStorage.removeItem('authName');
    window.location.href = 'login.html';
  };
})();
