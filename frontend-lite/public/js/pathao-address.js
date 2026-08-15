(function () {
  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function opt(value, label) {
    var o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    return o;
  }

  function idOf(item, keys) {
    for (var i = 0; i < keys.length; i++) {
      var n = Number(item[keys[i]]);
      if (n) return n;
    }
    return 0;
  }

  function nameOf(item, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (item[keys[i]]) return String(item[keys[i]]);
    }
    return '';
  }

  async function loadJson(url) {
    var res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Failed to load ' + url);
    return res.json();
  }

  function bindForm(form) {
    var base = form.getAttribute('data-pathao-base');
    if (!base) return;
    var citySel = qs('[data-pathao="city"]', form);
    var zoneSel = qs('[data-pathao="zone"]', form);
    var areaSel = qs('[data-pathao="area"]', form);
    var cityName = qs('[name="pathaoCityName"]', form);
    var zoneName = qs('[name="pathaoZoneName"]', form);
    var areaName = qs('[name="pathaoAreaName"]', form);
    if (!citySel || !zoneSel) return;

    function clear(sel, placeholder) {
      sel.innerHTML = '';
      sel.appendChild(opt('', placeholder));
    }

    async function loadCities() {
      clear(citySel, 'Select city');
      clear(zoneSel, 'Select zone / district');
      if (areaSel) clear(areaSel, 'Select area (optional)');
      var data = await loadJson(base + '/cities');
      (data.cities || []).forEach(function (c) {
        var id = idOf(c, ['city_id', 'id']);
        var name = nameOf(c, ['city_name', 'name']);
        if (id) citySel.appendChild(opt(String(id), name));
      });
      var pre = citySel.getAttribute('data-selected');
      if (pre) {
        citySel.value = pre;
        await loadZones();
      }
    }

    async function loadZones() {
      clear(zoneSel, 'Select zone / district');
      if (areaSel) clear(areaSel, 'Select area (optional)');
      var cityId = citySel.value;
      if (!cityId) return;
      var data = await loadJson(base + '/zones/' + encodeURIComponent(cityId));
      (data.zones || []).forEach(function (z) {
        var id = idOf(z, ['zone_id', 'id']);
        var name = nameOf(z, ['zone_name', 'name']);
        if (id) zoneSel.appendChild(opt(String(id), name));
      });
      var selected = citySel.options[citySel.selectedIndex];
      if (cityName) cityName.value = selected ? selected.textContent : '';
      var pre = zoneSel.getAttribute('data-selected');
      if (pre) {
        zoneSel.value = pre;
        await loadAreas();
      }
    }

    async function loadAreas() {
      if (!areaSel) return;
      clear(areaSel, 'Select area (optional)');
      var zoneId = zoneSel.value;
      if (!zoneId) return;
      var data = await loadJson(base + '/areas/' + encodeURIComponent(zoneId));
      (data.areas || []).forEach(function (a) {
        var id = idOf(a, ['area_id', 'id']);
        var name = nameOf(a, ['area_name', 'name']);
        if (id) areaSel.appendChild(opt(String(id), name));
      });
      var selected = zoneSel.options[zoneSel.selectedIndex];
      if (zoneName) zoneName.value = selected ? selected.textContent : '';
      var pre = areaSel.getAttribute('data-selected');
      if (pre) areaSel.value = pre;
    }

    citySel.addEventListener('change', function () {
      zoneSel.removeAttribute('data-selected');
      if (areaSel) areaSel.removeAttribute('data-selected');
      loadZones().catch(function () {});
    });
    zoneSel.addEventListener('change', function () {
      if (areaSel) areaSel.removeAttribute('data-selected');
      var selected = zoneSel.options[zoneSel.selectedIndex];
      if (zoneName) zoneName.value = selected ? selected.textContent : '';
      loadAreas().catch(function () {});
    });
    if (areaSel) {
      areaSel.addEventListener('change', function () {
        var selected = areaSel.options[areaSel.selectedIndex];
        if (areaName) areaName.value = selected && areaSel.value ? selected.textContent : '';
      });
    }

    loadCities().catch(function (err) {
      clear(citySel, 'Courier cities unavailable');
      console.warn(err);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    qsa('form[data-pathao-base]').forEach(bindForm);
  });
})();
