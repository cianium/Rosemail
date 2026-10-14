'use strict';

(() => {
  const content = window.ROSES_CONTENT;
  if (!content) {
    console.error('فایل content.js بارگذاری نشده است.');
    return;
  }

  const byId = (id) => document.getElementById(id);
  const stages = {
    cover: byId('coverStage'),
    letter: byId('letterStage'),
    calendar: byId('calendarStage'),
    final: byId('finalStage')
  };
  const media = byId('music');
  const musicButton = byId('musicBtn');
  const musicLabel = byId('musicLabel');
  const envelope = byId('openEnvelope');
  const calendarDays = byId('calendarDays');
  const calendarMonth = byId('calendarMonth');
  const selectedDateText = byId('selectionHint');
  const nextButton = byId('calendarNext');
  const shareButton = byId('shareBtn');
  const calendarSmsButton = byId('calendarSms');
  const smsComposer = byId('smsComposer');
  const smsMessage = byId('smsMessage');
  const toast = byId('toast');

  let currentStage = 'cover';
  let opening = false;
  let calendarType = 'persian';
  let visibleDate = normalizeDate(new Date());
  let selectedDate = null;
  let toastTimeout = null;

  const digits = new Intl.NumberFormat('fa-IR', { useGrouping: false });
  const dateFormats = {
    persian: {
      numeric: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric', numberingSystem: 'latn' }),
      month: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long' }),
      full: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    },
    gregory: {
      numeric: new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { year: 'numeric', month: 'numeric', day: 'numeric', numberingSystem: 'latn' }),
      month: new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { year: 'numeric', month: 'long' }),
      full: new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
  };

  function normalizeDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  }

  function addDays(date, amount) {
    const copy = normalizeDate(date);
    copy.setDate(copy.getDate() + amount);
    return copy;
  }

  function localDateId(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function calendarDay(date, type = calendarType) {
    const dayPart = dateFormats[type].numeric.formatToParts(date).find((part) => part.type === 'day');
    return Number(dayPart?.value);
  }

  function monthStart(date, type = calendarType) {
    return addDays(date, 1 - calendarDay(date, type));
  }

  function nextMonthStart(firstDate, type = calendarType) {
    // A Persian or Gregorian month always has <= 31 days.
    return monthStart(addDays(firstDate, 32), type);
  }

  function dayDistance(a, b) {
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((utcB - utcA) / 86400000);
  }

  function longDate(date, type) {
    return dateFormats[type].full.format(date);
  }

  function bothCalendars(date) {
    return `${longDate(date, 'persian')} (${longDate(date, 'gregory')})`;
  }

  function setCopy(container, paragraphs) {
    container.replaceChildren();
    for (const paragraph of paragraphs) {
      const el = document.createElement('p');
      el.textContent = paragraph;
      container.appendChild(el);
    }
  }

  function applyContent() {
    byId('letterOverline').textContent = content.letterOverline;
    byId('letterTitle').textContent = content.letterTitle;
    setCopy(byId('letterBody'), content.letterParagraphs);
    byId('letterSignature').textContent = content.letterSignature;
    byId('calendarTitle').textContent = content.calendarTitle;
    byId('calendarDescription').textContent = content.calendarDescription;
    byId('finalTitle').textContent = content.finalTitle;
    setCopy(byId('finalBody'), content.finalParagraphs);
    byId('finalSignature').textContent = content.finalSignature;
    byId('smsOpeningLine').textContent = `${content.smsOpeningLine}…`;
  }

  function showStage(target) {
    if (!stages[target]) return;
    currentStage = target;
    document.body.dataset.stage = target;
    if (target === 'cover') document.body.classList.remove('is-opening-letter');
    for (const [name, section] of Object.entries(stages)) {
      const active = name === target;
      section.classList.toggle('is-active', active);
      section.inert = !active;
      section.setAttribute('aria-hidden', String(!active));
    }
    const activeProgress = target === 'cover' ? 'letter' : target;
    document.querySelectorAll('[data-progress]').forEach((item) => {
      item.classList.toggle('is-current', item.dataset.progress === activeProgress);
    });
    byId('stepNumber').textContent = target === 'calendar' ? '02 / 03' : target === 'final' ? '03 / 03' : '01 / 03';
    window.scrollTo({ top: 0, behavior: 'instant' });
    const focus = target === 'letter' ? byId('letterCard') :
      target === 'calendar' ? byId('calendarTitle') :
      target === 'final' ? byId('finalTitle') : byId('openEnvelope');
    if (!focus.matches('button, input, select, textarea, a[href]') && !focus.hasAttribute('tabindex')) {
      focus.setAttribute('tabindex', '-1');
    }
    focus.focus({ preventScroll: true });
  }

  function showToast(message) {
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimeout = setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  function updateMusicButton() {
    const isPlaying = !media.paused;
    musicButton.setAttribute('aria-pressed', String(isPlaying));
    musicButton.setAttribute('aria-label', isPlaying ? 'توقف موسیقی' : 'پخش موسیقی');
    musicLabel.textContent = isPlaying ? 'توقف' : 'موسیقی';
  }

  async function startMusic() {
    try { await media.play(); }
    catch { updateMusicButton(); }
  }

  function openLetter() {
    if (opening || currentStage !== 'cover') return;
    opening = true;
    envelope.disabled = true;
    envelope.classList.add('is-opening');
    document.body.classList.add('is-opening-letter');
    // A user interaction is necessary for playback on mobile browsers.
    if (media.paused) void startMusic();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      showStage('letter');
      opening = false;
    }, reducedMotion ? 25 : 1050);
  }

  function renderCalendar() {
    const first = monthStart(visibleDate);
    const last = nextMonthStart(first);
    const numberOfDays = dayDistance(first, last);
    // getDay(): Sunday=0...Saturday=6. In Persian layouts, Saturday is the first column.
    const offset = (first.getDay() + 1) % 7;
    const label = dateFormats[calendarType].month.format(first);
    calendarMonth.textContent = label;
    calendarDays.replaceChildren();

    for (let i = 0; i < offset; i++) {
      const empty = document.createElement('span');
      empty.className = 'calendar__empty';
      empty.setAttribute('aria-hidden', 'true');
      calendarDays.appendChild(empty);
    }

    for (let dayNumber = 1; dayNumber <= numberOfDays; dayNumber++) {
      const date = addDays(first, dayNumber - 1);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'calendar__day';
      button.textContent = digits.format(dayNumber);
      button.setAttribute('aria-label', longDate(date, calendarType));
      button.setAttribute('aria-pressed', String(selectedDate !== null && localDateId(date) === localDateId(selectedDate)));
      if (localDateId(date) === localDateId(normalizeDate(new Date()))) {
        button.classList.add('is-today');
        button.setAttribute('aria-current', 'date');
      }
      if (date.getDay() === 5) button.classList.add('is-friday');
      if (selectedDate && localDateId(date) === localDateId(selectedDate)) button.classList.add('is-selected');
      button.addEventListener('click', () => {
        selectedDate = date;
        updateSelection();
        renderCalendar();
        // Restore keyboard focus after the calendar grid is rebuilt.
        const sameDay = calendarDays.querySelector('.is-selected');
        sameDay?.focus({ preventScroll: true });
      });
      calendarDays.appendChild(button);
    }
  }

  function updateSelection() {
    const hasDate = selectedDate !== null;
    nextButton.disabled = !hasDate;
    smsComposer.hidden = !hasDate;
    const canSend = hasDate && smsMessage.value.trim().length > 0;
    shareButton.hidden = !canSend;
    calendarSmsButton.hidden = !canSend;
    const smsLink = canSend ? makeSmsLink(selectedDate) : 'sms:';
    shareButton.href = smsLink;
    calendarSmsButton.href = smsLink;
    selectedDateText.textContent = hasDate ? `انتخاب تو: ${bothCalendars(selectedDate)}` : 'هنوز تاریخی انتخاب نشده.';
    byId('finalSelectedDate').textContent = hasDate ? bothCalendars(selectedDate) : 'بدون تاریخ مشخص';
    byId('finalDateNote').textContent = hasDate ? 'این فقط یک تاریخ پیشنهادی است، نه یک قرار قطعی.' : 'انتخاب نکردن هم کاملاً محترمه.';
  }

  function moveMonth(delta) {
    const first = monthStart(visibleDate);
    visibleDate = delta > 0 ? nextMonthStart(first) : monthStart(addDays(first, -1));
    renderCalendar();
  }

  // SMS is composed locally on the visitor's phone. Nothing is sent by the website.
  // A receiving number is optional until the owner configures it in content.js.
  function makeSmsLink(date) {
    const recipient = String(content.smsRecipient || '').trim();
    const validRecipient = /^\+?[0-9]{6,15}$/.test(recipient);
    const address = validRecipient ? recipient : '';
    const prefix = String(content.smsText || 'تاریخ انتخاب‌شده:');
    const reply = smsMessage.value.trim();
    const opening = String(content.smsOpeningLine || '').trim();
    const message = `${prefix}\n${bothCalendars(date)}\n\n${opening} ${reply}`;
    return `sms:${address}?body=${encodeURIComponent(message)}`;
  }

  function prepareSms(event) {
    if (!selectedDate) {
      event.preventDefault();
      return;
    }
    // Do not claim the SMS was sent: sending always requires confirmation in the SMS app.
    // Let the browser handle the original anchor click, preserving mobile user activation.
  }

  smsMessage.addEventListener('input', updateSelection);
  media.addEventListener('play', updateMusicButton);
  media.addEventListener('pause', updateMusicButton);
  media.addEventListener('ended', updateMusicButton);
  musicButton.addEventListener('click', () => { if (media.paused) void startMusic(); else media.pause(); });
  envelope.addEventListener('click', openLetter);
  byId('letterBack').addEventListener('click', () => {
    envelope.classList.remove('is-opening');
    envelope.disabled = false;
    showStage('cover');
  });
  byId('letterNext').addEventListener('click', () => { renderCalendar(); showStage('calendar'); });
  byId('calendarBack').addEventListener('click', () => showStage('letter'));
  byId('calendarSkip').addEventListener('click', () => { selectedDate = null; smsMessage.value = ''; updateSelection(); showStage('final'); });
  nextButton.addEventListener('click', () => { updateSelection(); showStage('final'); });
  byId('finalBack').addEventListener('click', () => { renderCalendar(); showStage('calendar'); });
  byId('restartBtn').addEventListener('click', () => {
    selectedDate = null;
    smsMessage.value = '';
    visibleDate = normalizeDate(new Date());
    calendarType = 'persian';
    document.querySelectorAll('[data-calendar]').forEach((button) => {
      const active = button.dataset.calendar === 'persian';
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateSelection();
    renderCalendar();
    envelope.classList.remove('is-opening');
    envelope.disabled = false;
    showStage('cover');
  });
  byId('prevMonth').addEventListener('click', () => moveMonth(-1));
  byId('nextMonth').addEventListener('click', () => moveMonth(1));
  byId('todayBtn').addEventListener('click', () => { visibleDate = normalizeDate(new Date()); renderCalendar(); });
  document.querySelectorAll('[data-calendar]').forEach((button) => {
    button.addEventListener('click', () => {
      calendarType = button.dataset.calendar;
      document.querySelectorAll('[data-calendar]').forEach((control) => {
        const active = control === button;
        control.classList.toggle('is-selected', active);
        control.setAttribute('aria-pressed', String(active));
      });
      renderCalendar();
    });
  });
  shareButton.addEventListener('click', prepareSms);
  calendarSmsButton.addEventListener('click', prepareSms);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const backgroundVideo = document.querySelector('.backdrop__video');
    if (typeof backgroundVideo?.pause === 'function') backgroundVideo.pause();
  }

  applyContent();
  updateSelection();
  renderCalendar();
  updateMusicButton();
})();
