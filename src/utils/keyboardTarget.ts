/**
 * 阅读器键盘焦点工具。
 *
 * 阅读区里 ←/→/空格/PageUp/PageDown 一律用于翻页，因此只有当焦点确实落在
 * 「自己要用这些键」的控件上时才把按键交还给它：
 *   - 文本录入控件（input / textarea / select / contenteditable）
 *   - 自带方向键语义的复合控件（滑块、数值框、列表、标签栏、树、表格…）
 *
 * 普通按钮 / 链接不占用方向键。之前把 button 也算作「按键宿主」，
 * 结果点过一次侧栏或顶部按钮后，焦点留在按钮上，方向键就再也翻不了页，
 * 同时按钮被 :focus-visible 画出蓝色描边，看起来像被「选中」。
 */
const KEY_OWNING_ROLE_SELECTOR = [
  "[role='textbox']",
  "[role='searchbox']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='option']",
  "[role='menu']",
  "[role='menubar']",
  "[role='tablist']",
  "[role='radiogroup']",
  "[role='tree']",
  "[role='grid']",
].join(",");

/** 当前焦点控件是否自己要消费这个按键（是则阅读器不要抢先处理）。 */
export function isKeyOwningWidget(target: EventTarget | null): boolean {
  // 注意用 Element 而不是 HTMLElement：按钮里的图标是 SVG，点击事件的目标会是 SVGElement。
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "OPTION") return true;
  return Boolean(target.closest(KEY_OWNING_ROLE_SELECTOR));
}

const INTERACTIVE_CONTROL_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  "[role='button']",
  "[role='menuitem']",
  "[role='tab']",
  "[role='option']",
  "[role='checkbox']",
  "[role='switch']",
].join(",");

/**
 * 找到被点/被聚焦的界面控件（按钮、链接等）。
 * 阅读器用它判断「这次点击是不是落在了工具按钮上」，好在点击结束后把键盘焦点收回到画面。
 */
export function findInteractiveControl(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest(INTERACTIVE_CONTROL_SELECTOR);
}
