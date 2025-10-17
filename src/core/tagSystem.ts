/**
 * 标签系统 - 管理装饰标签和对象标签
 * 按照文档实现，使用空格分隔的字符串存储标签
 */
export class TagSystem {
  // 需要缩放的装饰标签（前后都有空格，防止部分匹配）
  public tag: string = ' ';

  // 需要重命名的对象/文本标签
  public bad_tag: string = ' ';

  // 标签映射表：原标签 → 新标签(_new_***_)
  public tag_map: Map<string, string> = new Map();

  /**
   * 添加装饰标签（需要缩放）
   */
  addTag(tagName: string): void {
    if (!this.hasTag(tagName)) {
      this.tag += tagName + ' ';
    }
  }

  /**
   * 添加对象标签（需要重命名）
   */
  addBadTag(tagName: string): void {
    if (!this.hasBadTag(tagName)) {
      this.bad_tag += tagName + ' ';
      // 创建映射：原标签 → 新标签
      this.tag_map.set(tagName, tagName + '_new_***_');
    }
  }

  /**
   * 检查是否是装饰标签（需要缩放）
   * 使用空格包裹防止部分匹配
   */
  hasTag(tagName: string): boolean {
    return this.tag.includes(` ${tagName} `);
  }

  /**
   * 检查是否是对象标签（需要重命名）
   */
  hasBadTag(tagName: string): boolean {
    return this.bad_tag.includes(` ${tagName} `);
  }

  /**
   * 获取重命名后的标签
   */
  getMappedTag(tagName: string): string {
    return this.tag_map.get(tagName) || tagName;
  }

  /**
   * 重置标签系统
   */
  reset(): void {
    this.tag = ' ';
    this.bad_tag = ' ';
    this.tag_map.clear();
  }
}

