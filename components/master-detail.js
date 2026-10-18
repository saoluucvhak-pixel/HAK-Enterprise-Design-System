/**
 * HAK Master–Detail — bộ component bảng cha–con dùng chung (V10.5).
 *
 * Hợp nhất:
 *  - cách làm khai báo bằng cấu hình, đào sâu nhiều cấp, tự đóng phiên bản hiệu lực, luồng nháp → duyệt
 *    từ skill `quan-ly-bang-me-bang-con`;
 *  - bố cục danh sách trái / hồ sơ phải / Side Drawer từ LuongHAK_Offline V10.4 (HAK-Enterprise-Design-System);
 *  - và các thư viện chung: HAK_SMART_FILTER (lọc), HAK_SHEETS_CORE (hiệu lực, nhập), HAK_ACCOUNTING_REPORT_STANDARD (khóa kỳ).
 *
 * Hai lớp:
 *  1. createModel(config, opts) — LÕI không cần DOM: dữ liệu, quan hệ, điều hướng, kiểm tra, ghi qua adapter. Test được bằng Node.
 *  2. mount(element, model, opts) — GIAO DIỆN: vẽ bằng createElement/textContent (KHÔNG ghép dữ liệu vào innerHTML),
 *     chỉ dùng class `hak-md-*` + token màu của Design System.
 *
 * Chạy được: Apps Script HtmlService (dán vào <script>), Electron renderer, trình duyệt, Node (lõi).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAK = root.HAK || {}; root.HAK.masterDetail = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var PARENT_FIELD = "_parentId";
  var FIELD_TYPES = { text: 1, number: 1, money: 1, percent: 1, date: 1, select: 1, yesno: 1, textarea: 1, code: 1 };

  // ------------------------------------------------------------------ tiện ích
  /** Chữ đầu viết thường, giữ nguyên chữ viết tắt (BHXH, HĐLĐ). */
  function lc(s) { s = String(s || ""); return /^[A-ZĐ]{2,}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1); }
  function isBlank(v) { return v === null || v === undefined || v === ""; }
  function fold(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim(); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  /** Ngày → "yyyy-MM-dd" | null. Nhận Date, "yyyy-MM-dd", "dd/MM/yyyy"; Date năm ≤ 1900 (ô Time=0 của Sheets) = trống; từ chối ngày sai lịch. */
  function toISO(v) {
    if (isBlank(v) || v === 0) return null;
    if (Object.prototype.toString.call(v) === "[object Date]") {
      if (isNaN(v.getTime()) || v.getFullYear() <= 1900) return null;
      return v.getFullYear() + "-" + pad2(v.getMonth() + 1) + "-" + pad2(v.getDate());
    }
    var s = String(v).trim(), m, y, mo, d;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { y = +m[3]; mo = +m[2]; d = +m[1]; }
    else return null;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return y + "-" + pad2(mo) + "-" + pad2(d);
  }
  function isoToVN(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : ""; }
  function todayISO() { var t = new Date(); return t.getFullYear() + "-" + pad2(t.getMonth() + 1) + "-" + pad2(t.getDate()); }
  function newId() { return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function clone(o) { var c = {}; Object.keys(o || {}).forEach(function (k) { c[k] = o[k]; }); return c; }

  var NUM = typeof Intl !== "undefined" ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }) : null;
  function formatNumber(n, dec) {
    if (NUM && dec == null) return NUM.format(n);
    return typeof Intl !== "undefined" ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: dec == null ? 2 : dec }).format(n) : String(n);
  }

  // ------------------------------------------------------------------ cấu hình
  /**
   * config = {
   *   title: "Hồ sơ nhân sự",
   *   tables: {
   *     DM_NHANVIEN: { label, labelPlural?, key: ["MaNV"], fields: [...], columns: [...], titleField: "TenNV" },
   *     CT_HOPDONG:  { label, parent: "DM_NHANVIEN", fields, columns, drill: true, onDelete: "restrict"|"cascade",
   *                    versioning: { codeField: "SoHD", fromField: "HieuLucTu", toField: "HieuLucDen" } },
   *   },
   *   root: "DM_NHANVIEN"          // bảng hiển thị ở cấp đầu (mặc định: bảng đầu tiên không có parent)
   * }
   * field = { key, label, type: text|number|money|percent|date|select|yesno|textarea|code, required, refTable, refLabel, options, hint, readonly, decimals }
   */
  function validateConfig(config) {
    if (!config || typeof config.tables !== "object") throw new TypeError("config.tables là bắt buộc");
    var names = Object.keys(config.tables);
    if (!names.length) throw new TypeError("config.tables không được rỗng");
    names.forEach(function (t) {
      var c = config.tables[t];
      if (!c || !c.label || !Array.isArray(c.fields) || !c.fields.length) throw new TypeError(t + ": cần label và fields");
      var keys = {};
      c.fields.forEach(function (f) {
        if (!f || !f.key || !f.label) throw new TypeError(t + ": mỗi field cần key và label");
        if (keys[f.key]) throw new TypeError(t + ": trùng field " + f.key);
        keys[f.key] = 1;
        if (f.type && !FIELD_TYPES[f.type]) throw new TypeError(t + "." + f.key + ": type không hỗ trợ " + f.type);
        if (f.refTable && !config.tables[f.refTable]) throw new TypeError(t + "." + f.key + ": refTable " + f.refTable + " không có");
      });
      (c.columns || []).forEach(function (k) { if (!keys[k]) throw new TypeError(t + ": cột " + k + " không có trong fields"); });
      if (c.parent && !config.tables[c.parent]) throw new TypeError(t + ": parent " + c.parent + " không có");
      if (c.versioning) ["codeField", "fromField", "toField"].forEach(function (k) {
        if (!keys[c.versioning[k]]) throw new TypeError(t + ": versioning." + k + " phải là một field");
      });
    });
    // chặn vòng cha–con
    names.forEach(function (t) {
      var seen = {}, cur = t;
      while (cur) { if (seen[cur]) throw new TypeError("Vòng cha–con tại " + t); seen[cur] = 1; cur = config.tables[cur].parent; }
    });
    return config;
  }

  /** Adapter lưu trong bộ nhớ (mặc định / test). Adapter thật: Apps Script (google.script.run), Electron IPC, REST… */
  function memoryAdapter(initial) {
    var db = {};
    Object.keys(initial || {}).forEach(function (t) { db[t] = (initial[t] || []).map(clone); });
    return {
      load: function () { var out = {}; Object.keys(db).forEach(function (t) { out[t] = db[t].map(clone); }); return Promise.resolve(out); },
      insert: function (t, row) { (db[t] = db[t] || []).push(clone(row)); return Promise.resolve(clone(row)); },
      update: function (t, row) { var a = db[t] || [], i = a.findIndex(function (r) { return r._id === row._id; }); if (i < 0) return Promise.reject(new Error("Không tìm thấy dòng")); a[i] = clone(row); return Promise.resolve(clone(row)); },
      remove: function (t, id) { db[t] = (db[t] || []).filter(function (r) { return r._id !== id; }); return Promise.resolve(true); },
    };
  }

  // ------------------------------------------------------------------ LÕI
  /**
   * @param {Object} config
   * @param {Object} [opts]
   * @param {Object} [opts.adapter]       { load, insert, update, remove } — mặc định memoryAdapter(opts.data)
   * @param {Object} [opts.data]          dữ liệu ban đầu cho memoryAdapter
   * @param {function} [opts.beforeWrite] ({action, table, before, after}) → {ok, message?, warning?} — nơi gắn khóa kỳ / phân quyền
   * @param {function} [opts.canEdit]     (table) → boolean
   * @param {function} [opts.today]       () → "yyyy-MM-dd" (để test)
   */
  function createModel(config, opts) {
    validateConfig(config);
    opts = opts || {};
    var T = config.tables;
    var adapter = opts.adapter || memoryAdapter(opts.data);
    var data = {};
    var listeners = [];
    var rootTable = config.root || Object.keys(T).filter(function (t) { return !T[t].parent; })[0];
    var nav = [{ table: rootTable, id: null }]; // đường đi: [{table, id(dòng đang chọn)}]
    var search = {};
    var state = { loading: false, error: "" };
    var today = opts.today || todayISO;

    function emit() { listeners.slice().forEach(function (fn) { try { fn(api); } catch (e) { /* listener lỗi không làm hỏng model */ } }); }
    function cfg(t) { if (!T[t]) throw new RangeError("Bảng không có: " + t); return T[t]; }
    function field(t, k) { return cfg(t).fields.filter(function (f) { return f.key === k; })[0]; }
    function rows(t) { return data[t] || []; }
    function getRow(t, id) { return rows(t).filter(function (r) { return r._id === id; })[0] || null; }
    function childTables(t) { return Object.keys(T).filter(function (k) { return T[k].parent === t; }); }

    function rowsFor(t, parentId) {
      var c = cfg(t), list = rows(t);
      if (c.parent) list = list.filter(function (r) { return r[PARENT_FIELD] === parentId; });
      var q = fold(search[t] || "");
      if (q) {
        var cols = c.columns || c.fields.map(function (f) { return f.key; });
        list = list.filter(function (r) { return cols.some(function (k) { return fold(displayValue(t, k, r)).indexOf(q) >= 0; }); });
      }
      if (typeof opts.filter === "function") list = opts.filter(t, list, parentId) || list;
      return list;
    }

    // ----- phiên bản hiệu lực (tự đóng) — từ skill quan-ly-bang-me-bang-con
    /** "Hiệu lực đến" hiệu dụng: ô nhập tay nếu có, ngược lại ngày bắt đầu của phiên bản kế tiếp cùng mã (trừ 1 ngày). */
    function effectiveTo(t, row) {
      var v = cfg(t).versioning;
      if (!v) return null;
      var manual = toISO(row[v.toField]);
      if (manual) return manual;
      var from = toISO(row[v.fromField]);
      if (!from) return null;
      var next = null;
      rows(t).forEach(function (r) {
        if (r === row || r._id === row._id || r[v.codeField] !== row[v.codeField]) return;
        if (cfg(t).parent && r[PARENT_FIELD] !== row[PARENT_FIELD]) return;
        var f = toISO(r[v.fromField]);
        if (f && f > from && (!next || f < next)) next = f;
      });
      if (!next) return null;
      var d = new Date(next + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1);
      return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
    }
    /** "current" | "future" | "expired" | null (bảng không có phiên bản). */
    function versionStatus(t, row) {
      var v = cfg(t).versioning;
      if (!v) return null;
      var from = toISO(row[v.fromField]), to = effectiveTo(t, row), now = today();
      if (from && from > now) return "future";
      if (to && to < now) return "expired";
      return "current";
    }

    // ----- hiển thị
    function displayValue(t, k, row) {
      var f = field(t, k), v = row[k];
      var vcfg = cfg(t).versioning;
      if (vcfg && k === vcfg.toField && isBlank(v)) { var e = effectiveTo(t, row); return e ? isoToVN(e) + " (tự đóng)" : "Còn hiệu lực"; }
      if (!f || isBlank(v)) return "";
      switch (f.type) {
        case "date": return isoToVN(toISO(v)) || String(v);
        case "money": return isFinite(+v) ? formatNumber(+v, 0) : String(v);
        case "number": return isFinite(+v) ? formatNumber(+v, f.decimals) : String(v);
        case "percent": return isFinite(+v) ? formatNumber(+v * 100, 2) + "%" : String(v);
        case "yesno": return v === true || v === "true" || v === "TRUE" || v === "Có" ? "Có" : "Không";
        case "select":
          if (f.refTable) { var ref = getRow(f.refTable, v); return ref ? String(ref[f.refLabel || "_id"]) : String(v) + " (không tìm thấy)"; }
          return String(v);
        default: return String(v);
      }
    }
    function align(t, k) { var f = field(t, k), ty = f && f.type; return ty === "number" || ty === "money" || ty === "percent" ? "right" : ty === "date" ? "center" : "left"; }
    function titleOf(t, row) { var c = cfg(t); if (!row) return ""; var k = c.titleField || (c.columns || [])[1] || (c.columns || [])[0] || c.fields[0].key; return displayValue(t, k, row) || row._id; }

    // ----- điều hướng
    function current() { return nav[nav.length - 1]; }
    function select(id) { current().id = id; emit(); }
    /** Đào sâu vào một dòng của bảng con (có drill). ID cha lấy TỪ CHÍNH DÒNG — không tin trạng thái điều hướng cũ. */
    function drill(table, id) {
      var row = getRow(table, id);
      if (!row) throw new RangeError("Không tìm thấy dòng " + id);
      var c = cfg(table);
      if (!c.drill) throw new RangeError(table + " không cho đào sâu");
      var parentLevel = nav.findIndex(function (n) { return n.table === c.parent; });
      if (parentLevel < 0 || nav[parentLevel].id !== row[PARENT_FIELD]) {
        // điều hướng lệch dữ liệu → dựng lại đường đi từ chính dòng dữ liệu
        var path = [], cur = { table: table, row: row };
        while (cur.row && T[cur.table].parent) {
          var pt = T[cur.table].parent, pr = getRow(pt, cur.row[PARENT_FIELD]);
          path.unshift({ table: pt, id: pr ? pr._id : null });
          cur = { table: pt, row: pr };
        }
        nav = path.length ? path : [{ table: rootTable, id: null }];
        parentLevel = nav.length - 1;
      } else nav = nav.slice(0, parentLevel + 1);
      nav.push({ table: table, id: id });
      emit();
    }
    function back(level) { if (level >= 0 && level < nav.length) { nav = nav.slice(0, level + 1); emit(); } }
    function breadcrumb() {
      return nav.map(function (n, i) {
        var c = cfg(n.table), row = n.id ? getRow(n.table, n.id) : null;
        return { level: i, table: n.table, label: i === 0 && !row ? (c.labelPlural || c.label) : c.label + (row ? ": " + titleOf(n.table, row) : "") };
      });
    }

    // ----- kiểm tra dữ liệu
    function validate(t, row, isNew) {
      var c = cfg(t), errs = {};
      c.fields.forEach(function (f) {
        var v = row[f.key];
        if (f.required && isBlank(v)) { errs[f.key] = "Bắt buộc nhập " + f.label; return; }
        if (isBlank(v)) return;
        if ((f.type === "number" || f.type === "money" || f.type === "percent") && !isFinite(+v)) errs[f.key] = f.label + " phải là số";
        else if (f.type === "date" && !toISO(v)) errs[f.key] = f.label + " không phải ngày hợp lệ (dd/MM/yyyy)";
        else if (f.type === "select" && f.refTable && !getRow(f.refTable, v)) errs[f.key] = f.label + " không có trong danh mục";
        else if (f.type === "select" && f.options && f.options.indexOf(v) < 0) errs[f.key] = f.label + " không thuộc danh sách";
      });
      var v = c.versioning;
      if (v && toISO(row[v.toField]) && toISO(row[v.fromField]) && toISO(row[v.toField]) < toISO(row[v.fromField]))
        errs[v.toField] = "Hiệu lực đến phải sau Hiệu lực từ";
      // khóa nghiệp vụ không trùng (trong cùng cha); bảng có phiên bản: mã + hiệu lực từ
      var key = c.key || (v ? [v.codeField, v.fromField] : null);
      if (key && key.every(function (k) { return !isBlank(row[k]); })) {
        var norm = function (r) { return key.map(function (k) { var f = field(t, k); return f && f.type === "date" ? toISO(r[k]) : String(r[k]).trim(); }).join("\u0001"); };
        var mine = norm(row);
        var dup = rows(t).some(function (r) { return r._id !== row._id && (!c.parent || r[PARENT_FIELD] === row[PARENT_FIELD]) && norm(r) === mine; });
        if (dup) errs[key[0]] = "Đã có " + lc(c.label) + " với " + key.map(function (k) { return field(t, k).label; }).join(" + ") + " này";
      }
      return { ok: Object.keys(errs).length === 0, errors: errs };
    }

    function check(action, t, before, after) {
      if (typeof opts.canEdit === "function" && !opts.canEdit(t)) return { ok: false, message: "Bạn không có quyền sửa " + lc(cfg(t).label) };
      if (typeof opts.beforeWrite === "function") {
        var r = opts.beforeWrite({ action: action, table: t, before: before, after: after }) || { ok: true };
        if (r.ok === false) return r;
        return { ok: true, warning: r.warning || r.message || "" };
      }
      return { ok: true };
    }

    // ----- ghi
    function load() {
      state.loading = true; state.error = ""; emit();
      return Promise.resolve(adapter.load()).then(function (d) {
        data = {}; Object.keys(T).forEach(function (t) { data[t] = (d && d[t] || []).map(clone); });
        state.loading = false; emit(); return api;
      }, function (e) { state.loading = false; state.error = "Không tải được dữ liệu: " + (e && e.message || e); emit(); throw e; });
    }
    function save(t, input, parentId) {
      var c = cfg(t), isNew = !input._id, before = isNew ? null : getRow(t, input._id);
      if (!isNew && !before) return Promise.resolve({ ok: false, message: "Dòng đã bị xóa ở nơi khác — tải lại dữ liệu" });
      var row = clone(before || {});
      c.fields.forEach(function (f) { if (f.readonly) return; if (Object.prototype.hasOwnProperty.call(input, f.key)) row[f.key] = typeof input[f.key] === "string" ? input[f.key].trim() : input[f.key]; });
      if (isNew) { row._id = newId(); if (c.parent) row[PARENT_FIELD] = parentId != null ? parentId : nav.filter(function (n) { return n.table === c.parent; }).map(function (n) { return n.id; })[0]; }
      if (c.parent && !getRow(c.parent, row[PARENT_FIELD])) return Promise.resolve({ ok: false, message: "Chưa chọn " + lc(cfg(c.parent).label) });
      c.fields.forEach(function (f) { if (f.type === "date" && toISO(row[f.key])) row[f.key] = toISO(row[f.key]); });
      var v = validate(t, row, isNew);
      if (!v.ok) return Promise.resolve({ ok: false, errors: v.errors, message: "Còn " + Object.keys(v.errors).length + " ô chưa đúng" });
      var gate = check(isNew ? "insert" : "update", t, before, row);
      if (!gate.ok) return Promise.resolve({ ok: false, message: gate.message });
      return Promise.resolve(isNew ? adapter.insert(t, row) : adapter.update(t, row)).then(function () {
        if (isNew) rows(t).push(row);
        else data[t] = rows(t).map(function (r) { return r._id === row._id ? row : r; });
        emit();
        return { ok: true, row: row, warning: gate.warning || "" };
      }, function (e) { return { ok: false, message: "Lưu không thành công: " + (e && e.message || e) }; });
    }
    function descendants(t, id) {
      var out = [];
      childTables(t).forEach(function (ct) {
        rows(ct).filter(function (r) { return r[PARENT_FIELD] === id; }).forEach(function (r) { out.push({ table: ct, row: r }); out = out.concat(descendants(ct, r._id)); });
      });
      return out;
    }
    /** Xóa: mặc định CHẶN nếu còn dòng con (restrict); chỉ xóa kéo theo khi bảng khai báo onDelete: "cascade". */
    function remove(t, id) {
      var before = getRow(t, id);
      if (!before) return Promise.resolve({ ok: false, message: "Không tìm thấy dòng" });
      var kids = descendants(t, id);
      if (kids.length && cfg(t).onDelete !== "cascade") {
        var by = {}; kids.forEach(function (k) { by[k.table] = (by[k.table] || 0) + 1; });
        return Promise.resolve({ ok: false, message: "Còn dữ liệu con: " + Object.keys(by).map(function (k) { return by[k] + " " + lc(cfg(k).label); }).join(", ") + " — xóa dữ liệu con trước" });
      }
      var gate = check("delete", t, before, null);
      if (!gate.ok) return Promise.resolve({ ok: false, message: gate.message });
      for (var i = 0; i < kids.length; i++) { var g = check("delete", kids[i].table, kids[i].row, null); if (!g.ok) return Promise.resolve({ ok: false, message: g.message }); }
      var chain = Promise.resolve();
      kids.slice().reverse().forEach(function (k) { chain = chain.then(function () { return adapter.remove(k.table, k.row._id); }); });
      return chain.then(function () { return adapter.remove(t, id); }).then(function () {
        var gone = {}; gone[t + "\u0001" + id] = 1; kids.forEach(function (k) { gone[k.table + "\u0001" + k.row._id] = 1; });
        Object.keys(data).forEach(function (tt) { data[tt] = data[tt].filter(function (r) { return !gone[tt + "\u0001" + r._id]; }); });
        nav.forEach(function (n) { if (n.id && !getRow(n.table, n.id)) n.id = null; });
        while (nav.length > 1 && !nav[nav.length - 1].id) nav.pop();
        emit();
        return { ok: true, removed: 1 + kids.length, warning: gate.warning || "" };
      }, function (e) { return { ok: false, message: "Xóa không thành công: " + (e && e.message || e) }; });
    }

    function summary(t, parentId) {
      var list = rowsFor(t, parentId), c = cfg(t);
      var out = { total: list.length };
      if (c.versioning) { out.current = list.filter(function (r) { return versionStatus(t, r) === "current"; }).length; out.codes = Object.keys(list.reduce(function (a, r) { a[r[c.versioning.codeField]] = 1; return a; }, {})).length; }
      return out;
    }

    var api = {
      version: VERSION, config: config, state: state,
      load: load, save: save, remove: remove, validate: validate,
      rows: rows, rowsFor: rowsFor, getRow: getRow, childTables: childTables, cfg: cfg, field: field,
      displayValue: displayValue, align: align, titleOf: titleOf, effectiveTo: effectiveTo, versionStatus: versionStatus, summary: summary,
      nav: function () { return nav.map(clone); }, current: function () { return clone(current()); },
      select: select, drill: drill, back: back, breadcrumb: breadcrumb,
      setSearch: function (t, q) { search[t] = q || ""; emit(); }, getSearch: function (t) { return search[t] || ""; },
      canEdit: function (t) { return typeof opts.canEdit === "function" ? !!opts.canEdit(t) : true; },
      subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; },
      parentField: PARENT_FIELD,
    };
    return api;
  }

  // ------------------------------------------------------------------ GIAO DIỆN
  function el(doc, tag, cls, text, attrs) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k] === true ? "" : String(attrs[k])); });
    return e;
  }

  /**
   * Gắn giao diện vào element. Trả về { refresh, openDrawer, closeDrawer, destroy }.
   * opts.notify(message, kind) — hiện thông báo (mặc định: vùng thông báo trong component, aria-live).
   * opts.confirm(message) → Promise<boolean> | boolean — hỏi trước khi xóa (mặc định window.confirm).
   */
  function mount(host, model, opts) {
    opts = opts || {};
    var doc = host.ownerDocument;
    var lastFocus = null, drawerEl = null;
    host.classList.add("hak-ui", "hak-md");
    host.setAttribute("data-hak-md", model.version);

    function notify(msg, kind) {
      if (opts.notify) return opts.notify(msg, kind);
      var live = host.querySelector(".hak-md-toast");
      if (live) { live.textContent = msg; live.setAttribute("data-kind", kind || "info"); }
    }
    function confirmAsk(msg) { return Promise.resolve(opts.confirm ? opts.confirm(msg) : (doc.defaultView && doc.defaultView.confirm ? doc.defaultView.confirm(msg) : true)); }

    function table(t, list, selectedId, onPick, actions) {
      var c = model.cfg(t), cols = c.columns || c.fields.slice(0, 4).map(function (f) { return f.key; });
      if (model.state.loading) return el(doc, "div", "hak-state", "Đang tải dữ liệu…", { "data-state": "loading", role: "status" });
      if (model.state.error) return el(doc, "div", "hak-state", model.state.error, { "data-state": "error", role: "alert" });
      if (!list.length) return el(doc, "div", "hak-state", model.getSearch(t) ? "Không có " + lc(c.label) + " khớp từ khóa." : "Chưa có " + lc(c.label) + ".", { "data-state": "empty" });
      var wrap = el(doc, "div", "hak-table-region");
      var tb = el(doc, "table", "hak-table"), thead = el(doc, "thead"), hr = el(doc, "tr");
      cols.forEach(function (k) { var th = el(doc, "th", model.align(t, k) === "right" ? "hak-num" : "", model.field(t, k).label, { scope: "col" }); hr.appendChild(th); });
      if (c.versioning) hr.appendChild(el(doc, "th", "", "Trạng thái", { scope: "col" }));
      if (actions) hr.appendChild(el(doc, "th", "hak-md-actions-col", "", { scope: "col", "aria-label": "Thao tác" }));
      thead.appendChild(hr); tb.appendChild(thead);
      var body = el(doc, "tbody");
      list.forEach(function (r) {
        var tr = el(doc, "tr", "", null, { tabindex: onPick ? 0 : null, "aria-selected": onPick ? String(r._id === selectedId) : null, "data-id": r._id });
        cols.forEach(function (k) { var a = model.align(t, k); tr.appendChild(el(doc, "td", a === "right" ? "hak-num" : a === "center" ? "hak-md-center" : "", model.displayValue(t, k, r))); });
        if (c.versioning) { var st = model.versionStatus(t, r); var td = el(doc, "td"); td.appendChild(el(doc, "span", "hak-md-tag", { current: "Đang hiệu lực", future: "Chưa đến ngày", expired: "Hết hiệu lực" }[st], { "data-status": st })); tr.appendChild(td); }
        if (actions) { var tdA = el(doc, "td", "hak-md-row-actions"); actions(r).forEach(function (b) { tdA.appendChild(b); }); tr.appendChild(tdA); }
        if (onPick) {
          tr.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("button")) return; onPick(r); });
          tr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(r); } });
        }
        body.appendChild(tr);
      });
      tb.appendChild(body); wrap.appendChild(tb);
      return wrap;
    }

    function button(text, cls, onClick, attrs) { var b = el(doc, "button", "hak-btn" + (cls ? " " + cls : ""), text, Object.assign({ type: "button" }, attrs || {})); b.addEventListener("click", onClick); return b; }

    function searchBox(t) {
      var c = model.cfg(t), id = "hak-md-q-" + t;
      var box = el(doc, "div", "hak-md-search");
      box.appendChild(el(doc, "label", "hak-sr-only", "Tìm " + lc(c.label), { for: id }));
      var inp = el(doc, "input", "", null, { id: id, type: "search", placeholder: "Tìm " + lc(c.label) + " (gõ không dấu được)", value: model.getSearch(t), autocomplete: "off" });
      inp.addEventListener("input", function () { var pos = inp.selectionStart; model.setSearch(t, inp.value); var again = host.querySelector("#" + id); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* bỏ qua */ } } });
      box.appendChild(inp);
      return box;
    }

    function render() {
      var keepScroll = host.scrollTop;
      while (host.firstChild) host.removeChild(host.firstChild);
      var nav = model.nav(), level = nav.length - 1, cur = nav[level], c = model.cfg(cur.table);
      var parentId = level > 0 ? nav[level - 1].id : null;

      // Đầu trang: breadcrumb + tiêu đề + hành động
      var head = el(doc, "header", "hak-md-head");
      var bc = el(doc, "nav", "hak-md-breadcrumb", null, { "aria-label": "Đường dẫn" }), ol = el(doc, "ol");
      model.breadcrumb().forEach(function (b, i, arr) {
        var li = el(doc, "li");
        if (i < arr.length - 1) li.appendChild(button(b.label, "hak-md-link", function () { model.back(b.level); }));
        else li.appendChild(el(doc, "span", "", b.label, { "aria-current": "page" }));
        ol.appendChild(li);
      });
      bc.appendChild(ol); head.appendChild(bc);
      var titleRow = el(doc, "div", "hak-md-title-row");
      titleRow.appendChild(el(doc, "h1", "", level === 0 ? (model.config.title || c.labelPlural || c.label) : c.label + ": " + model.titleOf(cur.table, model.getRow(cur.table, cur.id))));
      var acts = el(doc, "div", "hak-md-actions");
      if (level > 0) acts.appendChild(button("← Quay lại", "", function () { model.back(level - 1); }));
      if (model.canEdit(cur.table) && level === 0) acts.appendChild(button("+ Thêm " + lc(c.label), "hak-btn-primary", function () { openDrawer(cur.table, null, parentId); }));
      titleRow.appendChild(acts); head.appendChild(titleRow);
      host.appendChild(head);

      // Thẻ tóm tắt
      var sum = model.summary(cur.table, parentId), metrics = el(doc, "div", "hak-md-metrics");
      function metric(label, value) { var m = el(doc, "div", "hak-md-metric"); m.appendChild(el(doc, "small", "", label)); m.appendChild(el(doc, "strong", "hak-num", formatNumber(value, 0))); metrics.appendChild(m); }
      metric(level === 0 ? "Số " + lc(c.label) + " đang lọc" : "Dòng " + lc(c.label), sum.total);
      if (sum.current != null) { metric("Đang hiệu lực", sum.current); metric("Số mã", sum.codes); }
      metric("Bảng con", model.childTables(cur.table).length);
      host.appendChild(metrics);

      // Hai vùng: danh sách (trái) — hồ sơ đang chọn (phải)
      var grid = el(doc, "div", "hak-master-detail");
      var master = el(doc, "section", "hak-panel hak-md-master", null, { "aria-label": "Danh sách " + lc(c.label) });
      var mh = el(doc, "div", "hak-toolbar"); mh.appendChild(el(doc, "h2", "hak-md-pane-title", c.labelPlural || c.label)); mh.appendChild(searchBox(cur.table));
      master.appendChild(mh);
      master.appendChild(table(cur.table, model.rowsFor(cur.table, parentId), cur.id, function (r) { model.select(r._id); }));
      grid.appendChild(master);

      var detail = el(doc, "section", "hak-panel hak-md-detail", null, { "aria-label": "Hồ sơ đang chọn" });
      var row = cur.id ? model.getRow(cur.table, cur.id) : null;
      if (!row) detail.appendChild(el(doc, "div", "hak-state", "Chọn một " + lc(c.label) + " ở danh sách để xem hồ sơ.", { "data-state": "empty" }));
      else renderDetail(detail, cur.table, row);
      grid.appendChild(detail);
      host.appendChild(grid);
      host.appendChild(el(doc, "div", "hak-md-toast", "", { role: "status", "aria-live": "polite" }));
      host.scrollTop = keepScroll;
    }

    function renderDetail(box, t, row) {
      var c = model.cfg(t);
      var dh = el(doc, "div", "hak-toolbar hak-md-detail-head");
      dh.appendChild(el(doc, "h2", "hak-md-pane-title", model.titleOf(t, row)));
      var da = el(doc, "div", "hak-md-actions");
      if (model.canEdit(t)) {
        da.appendChild(button("Sửa", "hak-btn-primary", function () { openDrawer(t, row, null); }));
        da.appendChild(button("Xóa", "", function () { doDelete(t, row); }));
      }
      dh.appendChild(da); box.appendChild(dh);

      var fields = el(doc, "dl", "hak-md-fields");
      c.fields.forEach(function (f) {
        var item = el(doc, "div", "hak-md-field");
        item.appendChild(el(doc, "dt", "", f.label));
        item.appendChild(el(doc, "dd", model.align(t, f.key) === "right" ? "hak-num" : "", model.displayValue(t, f.key, row) || "—"));
        fields.appendChild(item);
      });
      box.appendChild(fields);

      var kids = model.childTables(t);
      if (!kids.length) return;
      var tabs = el(doc, "div", "hak-detail-tabs hak-md-tabs", null, { role: "tablist", "aria-label": "Dữ liệu con" });
      var active = box.getAttribute("data-tab") || host.getAttribute("data-tab-" + t) || kids[0];
      if (kids.indexOf(active) < 0) active = kids[0];
      var panel = el(doc, "div", "hak-md-tabpanel", null, { role: "tabpanel" });
      kids.forEach(function (k, i) {
        var n = model.rowsFor(k, row._id).length;
        var tab = button(model.cfg(k).labelPlural || model.cfg(k).label, "hak-md-tab", function () { host.setAttribute("data-tab-" + t, k); render(); var again = host.querySelector('[data-tab-key="' + k + '"]'); if (again) again.focus(); },
          { role: "tab", "aria-selected": String(k === active), "data-tab-key": k, tabindex: k === active ? 0 : -1 });
        tab.appendChild(el(doc, "span", "hak-md-count", " " + n));
        tab.addEventListener("keydown", function (e) {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          var j = (i + (e.key === "ArrowRight" ? 1 : kids.length - 1)) % kids.length;
          host.setAttribute("data-tab-" + t, kids[j]); render(); var again = host.querySelector('[data-tab-key="' + kids[j] + '"]'); if (again) again.focus();
        });
        tabs.appendChild(tab);
      });
      box.appendChild(tabs);
      var kc = model.cfg(active);
      var bar = el(doc, "div", "hak-toolbar");
      if (model.canEdit(active)) bar.appendChild(button("+ Thêm " + lc(kc.label), "hak-btn-primary", function () { openDrawer(active, null, row._id); }));
      panel.appendChild(bar);
      panel.appendChild(table(active, model.rowsFor(active, row._id), null, null, function (r) {
        var b = [];
        if (kc.drill) b.push(button("Xem chi tiết →", "", function () { model.drill(active, r._id); }, { "aria-label": "Xem chi tiết " + model.titleOf(active, r) }));
        if (model.canEdit(active)) {
          b.push(button("Sửa", "", function () { openDrawer(active, r, row._id); }, { "aria-label": "Sửa " + model.titleOf(active, r) }));
          b.push(button("Xóa", "", function () { doDelete(active, r); }, { "aria-label": "Xóa " + model.titleOf(active, r) }));
        }
        return b;
      }));
      box.appendChild(panel);
    }

    function doDelete(t, row) {
      return confirmAsk("Xóa " + lc(model.cfg(t).label) + " “" + model.titleOf(t, row) + "”?").then(function (yes) {
        if (!yes) return null;
        return model.remove(t, row._id).then(function (r) { notify(r.ok ? "Đã xóa." + (r.warning ? " " + r.warning : "") : r.message, r.ok ? (r.warning ? "warn" : "ok") : "error"); return r; });
      });
    }

    // ----- Side Drawer Thêm/Sửa
    function input(t, f, value) {
      var id = "hak-md-f-" + f.key, w;
      if (f.type === "select") {
        w = el(doc, "select", "", null, { id: id, name: f.key });
        w.appendChild(el(doc, "option", "", "— Chọn —", { value: "" }));
        var opts2 = f.refTable ? model.rows(f.refTable).map(function (r) { return { v: r._id, l: r[f.refLabel || "_id"] }; }) : (f.options || []).map(function (o) { return { v: o, l: o }; });
        opts2.forEach(function (o) { w.appendChild(el(doc, "option", "", o.l, { value: o.v, selected: String(o.v) === String(value) })); });
      } else if (f.type === "textarea") { w = el(doc, "textarea", "", null, { id: id, name: f.key, rows: 3 }); w.value = isBlank(value) ? "" : String(value); }
      else if (f.type === "yesno") { w = el(doc, "input", "", null, { id: id, name: f.key, type: "checkbox" }); w.checked = value === true || value === "true" || value === "Có"; }
      else {
        var type = f.type === "date" ? "date" : (f.type === "number" || f.type === "money" || f.type === "percent") ? "number" : "text";
        w = el(doc, "input", "", null, { id: id, name: f.key, type: type, step: type === "number" ? "any" : null, inputmode: type === "number" ? "decimal" : null });
        w.value = isBlank(value) ? "" : f.type === "date" ? (toISO(value) || "") : String(value);
      }
      if (f.required) w.setAttribute("aria-required", "true");
      if (f.readonly) w.setAttribute("disabled", "");
      return w;
    }

    function openDrawer(t, row, parentId) {
      closeDrawer(true);
      var c = model.cfg(t), isNew = !row;
      lastFocus = doc.activeElement;
      var overlay = el(doc, "div", "hak-md-overlay");
      var dr = el(doc, "aside", "hak-md-drawer", null, { role: "dialog", "aria-modal": "true", "aria-labelledby": "hak-md-drawer-title" });
      var hd = el(doc, "header", "hak-md-drawer-head");
      hd.appendChild(el(doc, "h2", "", (isNew ? "Thêm " : "Sửa ") + lc(c.label), { id: "hak-md-drawer-title" }));
      hd.appendChild(button("✕", "hak-md-close", function () { closeDrawer(); }, { "aria-label": "Đóng" }));
      dr.appendChild(hd);
      var form = el(doc, "form", "hak-md-form", null, { novalidate: true });
      var summaryBox = el(doc, "div", "hak-md-error-summary", null, { role: "alert", tabindex: -1, hidden: true });
      form.appendChild(summaryBox);
      var vcfg = c.versioning;
      c.fields.forEach(function (f) {
        var wrap = el(doc, "div", "hak-md-input");
        var lab = el(doc, "label", "", f.label, { for: "hak-md-f-" + f.key });
        if (f.required) lab.appendChild(el(doc, "span", "hak-md-req", " *", { "aria-hidden": "true" }));
        wrap.appendChild(lab);
        wrap.appendChild(input(t, f, row ? row[f.key] : f.default));
        var hint = f.hint || (vcfg && f.key === vcfg.toField ? "Để trống: tự đóng khi có phiên bản mới cùng mã" : "");
        if (hint) wrap.appendChild(el(doc, "div", "hak-muted hak-md-hint", hint));
        wrap.appendChild(el(doc, "div", "hak-field-error", "", { id: "hak-md-e-" + f.key, hidden: true }));
        form.appendChild(wrap);
      });
      var ft = el(doc, "footer", "hak-md-drawer-foot");
      var saveBtn = el(doc, "button", "hak-btn hak-btn-primary", "Lưu", { type: "submit" });
      ft.appendChild(button("Hủy", "", function () { closeDrawer(); }));
      ft.appendChild(saveBtn);
      form.appendChild(ft);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var values = row ? { _id: row._id } : {};
        c.fields.forEach(function (f) { var w = form.querySelector("#hak-md-f-" + f.key); if (!w || f.readonly) return; values[f.key] = f.type === "yesno" ? w.checked : w.value; });
        saveBtn.disabled = true; saveBtn.textContent = "Đang lưu…";
        return model.save(t, values, parentId).then(function (r) {
          saveBtn.disabled = false; saveBtn.textContent = "Lưu";
          c.fields.forEach(function (f) { var w = form.querySelector("#hak-md-f-" + f.key), m = form.querySelector("#hak-md-e-" + f.key); if (w) w.removeAttribute("aria-invalid"); if (m) { m.hidden = true; m.textContent = ""; } });
          if (r.ok) { closeDrawer(true); render(); notify("Đã lưu." + (r.warning ? " " + r.warning : ""), r.warning ? "warn" : "ok"); return r; }
          var errs = r.errors || {}, keys = Object.keys(errs);
          while (summaryBox.firstChild) summaryBox.removeChild(summaryBox.firstChild);
          summaryBox.appendChild(el(doc, "strong", "", r.message || "Chưa lưu được"));
          if (keys.length) {
            var ul = el(doc, "ul");
            keys.forEach(function (k) {
              var w = form.querySelector("#hak-md-f-" + k), m = form.querySelector("#hak-md-e-" + k);
              if (w) { w.setAttribute("aria-invalid", "true"); w.setAttribute("aria-describedby", "hak-md-e-" + k); }
              if (m) { m.hidden = false; m.textContent = errs[k]; }
              var li = el(doc, "li"), a = el(doc, "a", "", errs[k], { href: "#hak-md-f-" + k });
              a.addEventListener("click", function (ev) { ev.preventDefault(); if (w) w.focus(); });
              li.appendChild(a); ul.appendChild(li);
            });
            summaryBox.appendChild(ul);
          }
          summaryBox.hidden = false; summaryBox.focus();
          return r;
        });
      });
      dr.appendChild(form);
      overlay.appendChild(dr);
      // đóng khi bấm đúng nền mờ (không dùng stopPropagation — bài học từ skill quan-ly-bang-me-bang-con)
      overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) closeDrawer(); });
      overlay.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); closeDrawer(); return; }
        if (e.key !== "Tab") return;
        var f = Array.prototype.filter.call(dr.querySelectorAll("button, input, select, textarea, a[href]"), function (x) { return !x.disabled && !x.hidden; });
        if (!f.length) return;
        if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      });
      host.appendChild(overlay);
      drawerEl = overlay;
      var first = form.querySelector("input:not([disabled]), select:not([disabled]), textarea:not([disabled])");
      if (first) first.focus();
      return dr;
    }
    function closeDrawer(silent) {
      if (!drawerEl) return;
      if (drawerEl.parentNode) drawerEl.parentNode.removeChild(drawerEl);
      drawerEl = null;
      if (!silent && lastFocus && lastFocus.focus && doc.contains(lastFocus)) lastFocus.focus();
    }

    var unsub = model.subscribe(function () { if (!drawerEl) render(); });
    render();
    return {
      refresh: render, openDrawer: openDrawer, closeDrawer: closeDrawer,
      destroy: function () { unsub(); closeDrawer(true); while (host.firstChild) host.removeChild(host.firstChild); host.classList.remove("hak-md"); },
    };
  }

  return { VERSION: VERSION, createModel: createModel, mount: mount, memoryAdapter: memoryAdapter, validateConfig: validateConfig, toISO: toISO, fold: fold };
});
