// 判断一段文字是不是"中文为主"，用来决定用中文还是英文来解释。
globalThis.YJ_LANG = {
  looksChinese(text) {
    const s = String(text || "");
    const cjk = (s.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
    if (cjk < 2) return false; // 单个汉字多半是符号或误选
    const latin = (s.match(/[A-Za-z]/g) || []).length;
    // 中英混排（"ACCA 是一个证书"）时，汉字占三成就按中文处理
    return cjk / (cjk + latin) >= 0.3;
  }
};
