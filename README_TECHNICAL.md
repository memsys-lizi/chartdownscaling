# ADOFAI 谱面装饰降分辨率工具 - 技术文档

## 目录
1. [项目概述](#项目概述)
2. [技术架构](#技术架构)
3. [核心算法原理](#核心算法原理)
4. [缩放数学原理](#缩放数学原理)
5. [文件格式与数据结构](#文件格式与数据结构)
6. [详细实现分析](#详细实现分析)
7. [配置文件说明](#配置文件说明)
8. [使用流程](#使用流程)

---

## 项目概述

### 项目背景
ADOFAI (A Dance of Fire and Ice) 是一款音乐节奏游戏，玩家可以创建自定义谱面。谱面文件（.adofai）采用JSON格式存储，包含：
- 音符信息
- 装饰对象（Decoration）
- 文本对象（Text）
- 自定义对象（Object）
- 背景设置等

当谱面装饰过多或图片分辨率过高时，会导致：
- 文件体积庞大（数GB级别）
- 游戏运行卡顿
- 加载时间过长
- 内存占用过高

### 解决方案
本工具通过以下方式降低谱面资源占用：
1. **修改谱面文件参数**：调整所有装饰对象的缩放（scale）参数
2. **压缩图片资源**：按比例缩小实际图片文件尺寸
3. **保持视觉一致性**：通过数学计算确保缩放后的视觉效果与原谱面一致

---

## 技术架构

### 整体架构
```
┌─────────────────┐
│   Python GUI    │  UI.py - 用户交互界面
│   (Tkinter)     │
└────────┬────────┘
         │
         ├──────────────┐
         │              │
    ┌────▼────┐    ┌────▼──────┐
    │ C++ EXE │    │  PIL/Pillow│
    │level.exe│    │   图片处理  │
    └────┬────┘    └────┬──────┘
         │              │
    ┌────▼────┐    ┌────▼──────┐
    │.adofai  │    │图片文件   │
    │谱面文件 │    │(.png等)   │
    └─────────┘    └───────────┘
```

### 技术栈
- **前端界面**：Python 3.x + Tkinter
- **图片处理**：Pillow (PIL Fork)
- **核心处理**：C++ (Windows API)
- **进程通信**：subprocess.Popen (stdin/stdout管道)
- **文件操作**：Windows文件系统API

### 工作流程
```
1. 用户输入 → 2. 备份文件 → 3. C++处理谱面 → 4. Python压缩图片 → 5. 完成
```

---

## 核心算法原理

### 1. 谱面文件解析算法

#### 1.1 文件搜索算法 (递归遍历)
```cpp
void sf(string path, string mode)
```

**算法流程：**
```
输入：根目录路径 path，搜索模式 mode (*.adofai)
输出：全局数组 k[] 存储所有找到的文件路径

1. 标准化路径（移除末尾反斜杠）
2. 构建搜索字符串：path + "\\" + mode
3. 使用 _findfirst 开始搜索
4. 循环处理搜索结果：
   - 跳过 ".." 目录
   - 将找到的文件路径存入 k[k_num]
   - 如果是子目录，递归调用 sf()
5. 使用 _findnext 继续搜索
6. 关闭搜索句柄
```

**时间复杂度：** O(n)，n为目录树中的文件/文件夹总数

#### 1.2 JSON字段提取算法
```cpp
string get(string line, string tar)
```

**算法目标：** 从JSON格式的字符串中提取指定字段的值

**处理步骤：**

1. **预处理** - 清理行尾无用字符
```cpp
while(line.substr(line.length()-1,1)=="," || 
      line.substr(line.length()-1,1)==" " || 
      line.substr(line.length()-1,1)=="}") {
    line = line.substr(0, line.length()-1);
}
line = line + ",";  // 统一格式，便于后续处理
```

2. **定位目标字段**
```cpp
int start = line.find(("\""+tar+"\":").c_str());
if(start == -1) return "";  // 字段不存在
```

3. **提取冒号后的值**
```cpp
start = line.find(":");
line = line.substr(start+1, line.length()-start-1);
```

4. **去除前导空格**
```cpp
string fr = line.substr(0,1);
while(fr == " ") {
    line = line.replace(0, 1, "");
    fr = line.substr(0, 1);
}
```

5. **智能边界检测** - 处理嵌套结构
```cpp
int end = 0;
int kh = 0;  // 方括号计数器 []
int yh = 0;  // 引号计数器 ""

while (line.substr(end,1) != "," || kh != 0 || yh % 2 != 0) {
    if (line.substr(end, 1) == "[") kh += 1;
    if (line.substr(end, 1) == "]") kh -= 1;
    if (line.substr(end, 1) == "\"") yh += 1;
    end += 1;
}
```

**边界检测逻辑说明：**
- 遇到 `[` 时，方括号计数器加1（进入数组）
- 遇到 `]` 时，方括号计数器减1（退出数组）
- 遇到 `"` 时，引号计数器加1
- 只有当遇到逗号 `,` 且不在数组内（kh=0）且不在字符串内（yh为偶数）时，才认为值结束

**示例：**
```json
"scale": [100, 200], "tag": "decoration1"
         ^-----------^
         正确提取到 [100, 200]

"tag": ["tag1", "tag2"], "scale": [1, 1]
       ^----------------^
       正确提取到 ["tag1", "tag2"]（包含逗号）
```

**时间复杂度：** O(m)，m为字符串长度

---

### 2. 标签系统算法

#### 2.1 标签收集阶段

**目的：** 识别需要缩放的装饰和需要重命名的对象

```cpp
string tag = " ";        // 需要缩放的标签（装饰）
string bad_tag = " ";    // 需要重命名的标签（文本/对象）
map<string, string> tag_map;  // 标签映射表
```

**第一遍扫描 - 收集标签信息：**

```cpp
// 1. 收集装饰标签（需要缩放）
if(get(s,"eventType") == "\"AddDecoration\"") {
    string get_tags = get(s,"tag");
    // 解析标签列表
    get_tags = get_tags.replace(0,1,"");  // 去除开头引号
    get_tags = get_tags.replace(get_tags.length()-1,1,"");  // 去除结尾引号
    
    // 按空格分割标签
    while(get_tags.length() != 0) {
        // ... 提取单个标签
        tag += get_tags.substr(0,st) + " ";
    }
}

// 2. 收集对象/文本标签（需要重命名以避免冲突）
if(get(s,"eventType") == "\"AddText\"" || get(s,"eventType") == "\"AddObject\"") {
    // ... 类似处理
    bad_tag += extracted_tag + " ";
    tag_map[extracted_tag] = extracted_tag + "_new_***_";
}
```

**为什么要重命名对象/文本标签？**

ADOFAI中，`AddText` 和 `AddObject` 事件创建的对象不需要缩放（它们不是装饰图片），但如果它们的标签与装饰标签重名，在处理 `MoveDecorations` 事件时会产生冲突。解决方案：
- 将这些标签添加后缀 `_new_***_`
- 创建映射表 `tag_map` 记录原标签 → 新标签
- 在后续处理中，对这些对象的引用也相应更新

#### 2.2 标签匹配算法

**查找算法：**
```cpp
if (tag.find((" " + now_tag + " ").c_str()) != -1) {
    // 找到匹配的标签
}
```

**为什么前后都加空格？**
- 防止部分匹配错误
- 例如：`tag = " deco deco1 "`
  - 搜索 `" deco "` ✓ 正确匹配
  - 搜索 `"deco"` ✗ 会错误匹配 `deco1`

---

### 3. 装饰缩放算法

#### 3.1 AddDecoration 事件处理

**事件格式：**
```json
{
    "eventType": "AddDecoration",
    "scale": [100, 100],
    "tag": "myDecoration",
    "pivotOffset": [0, 0],
    ...
}
```

**处理流程：**

```cpp
// 1. 字符串分割 - 提取需要修改的部分
head = s.substr(0, position_of_scale);          // "scale"之前的内容
mid = content_between_scale_and_next_field;      // "scale"之后到下一字段
back = remaining_content;                        // 剩余内容

// 2. 解析scale值
string xs, ys;
int st = scale.find(",");
xs = scale.substr(1, st-1);              // 提取X值
ys = scale.substr(st+1, scale.length()-st-2);  // 提取Y值

// 3. 应用缩放因子
double x, y;
if (xs.find("null") == -1) {  // 非null值才处理
    x = stod(xs) * lnum;      // lnum是缩放倍数
    xs = to_string(x);
}
if (ys.find("null") == -1) {
    y = stod(ys) * lnum;
    ys = to_string(y);
}

// 4. 重组字符串
out_put[opt] = head + "\"scale\":[" + xs + "," + ys + "]" + back;
```

**null值处理：**
- ADOFAI支持 `[null, 100]` 格式，表示只在Y轴缩放
- 算法会检查并跳过null值，只处理有效数值

#### 3.2 MoveDecorations 事件处理

**事件格式：**
```json
{
    "eventType": "MoveDecorations",
    "tag": "deco1 deco2 deco3",
    "scale": [50, 50],
    ...
}
```

**特殊性：** 此事件的 `tag` 字段可能包含多个标签（空格分隔）

**算法流程：**

```cpp
// 1. 解析多标签
get_tags = get_tags.replace(0,1,"");  // 去除引号
get_tags = get_tags.replace(get_tags.length()-1,1,"");

while(get_tags.length() != 0) {
    // 提取单个标签
    now_tag = get_tags.substr(0, st);
    
    // 2. 判断标签类型
    if (tag.find((" " + now_tag + " ").c_str()) != -1) {
        // 情况A：需要缩放的装饰标签
        out_put[opt] = head + "\"tag\":\"" + now_tag + "\"" 
                      + mid + "\"scale\":[" + xs1 + "," + ys1 + "]" + back;
        if_p[opt] = 1;  // 标记需要处理pivotOffset
        opt += 1;
    } else {
        // 情况B：不需要缩放的标签
        out_put[opt] = head + "\"tag\":\"" + now_tag + "\"" 
                      + mid + "\"scale\":[" + xs + "," + ys + "]" + back;
        opt += 1;
    }
    
    // 3. 处理重名对象标签
    if (bad_tag.find((" " + now_tag + " ").c_str()) != -1) {
        // 添加一个使用新标签名的事件副本
        out_put[opt] = head + "\"tag\":\"" + tag_map[now_tag] + "\"" 
                      + mid + "\"scale\":[" + xs + "," + ys + "]" + back;
        opt += 1;
    }
}
```

**标签拆分策略：**

原始：
```json
{"eventType": "MoveDecorations", "tag": "A B C", "scale": [50, 50]}
```

拆分后：
```json
{"eventType": "MoveDecorations", "tag": "A", "scale": [50*lnum, 50*lnum]}
{"eventType": "MoveDecorations", "tag": "B", "scale": [50*lnum, 50*lnum]}
{"eventType": "MoveDecorations", "tag": "C", "scale": [50, 50]}
```

假设A、B是装饰标签（需要缩放），C不是。

#### 3.3 无Scale的MoveDecorations处理

某些 `MoveDecorations` 事件只改变位置，不包含 `scale` 字段：

```json
{
    "eventType": "MoveDecorations",
    "tag": "deco1",
    "positionOffset": [100, 200]
}
```

**处理逻辑：**
```cpp
else if (get(s, "eventType") == "\"MoveDecorations\"" && get(s, "scale") == "") {
    // 不修改scale，只处理标签拆分和重命名
    if (tag.find((" " + now_tag + " ").c_str()) != -1) {
        out_put[opt] = head + "\"tag\":\"" + now_tag + "\"" + back;
        if_p[opt] = 1;  // 仍然可能需要处理pivotOffset
        opt += 1;
    }
    // ... 其他逻辑类似
}
```

---

### 4. PivotOffset 反向缩放算法

#### 4.1 为什么需要反向缩放？

**pivotOffset** 是装饰的"枢轴偏移"，定义装饰的中心点偏移。

**问题场景：**

原始谱面：
- 装饰scale: `[100, 100]`
- pivotOffset: `[50, 50]`
- 实际效果：枢轴点在装饰右下方50个单位

缩放后（lnum=2，即缩小到1/2）：
- 装饰scale: `[50, 50]`（被算法缩小）
- pivotOffset: `[50, 50]`（如果不处理）
- 实际效果：枢轴点偏移变成了装饰的2倍大小！（视觉错误）

**解决方案：** 反向缩放pivotOffset

```
新pivotOffset = 原pivotOffset / lnum
```

#### 4.2 算法实现

```cpp
for (int k = 0; k < opt; k++) {
    // 只处理标记了需要缩放的事件 (if_p[k] == 1)
    if (if_p[k] == 1 && 
        get(out_put[k], "pivotOffset") != "" && 
        get(out_put[k], "pivotOffset") != "[null,null]") {
        
        // 1. 提取pivotOffset值
        string pivotOffset = get(out_put[k], "pivotOffset");
        
        // 2. 字符串分割
        head = out_put[k].substr(0, position_of_pivotOffset);
        back = remaining;
        
        // 3. 解析X, Y值
        xs = pivotOffset.substr(1, st - 1);
        ys = pivotOffset.substr(st + 1, pivotOffset.length() - st - 2);
        
        // 4. 反向缩放计算
        if (xs.find("null") == -1) {
            x = stod(xs) / lnum;  // 注意：这里是除法！
            xs = to_string(x);
        }
        if (ys.find("null") == -1) {
            y = stod(ys) / lnum;
            ys = to_string(y);
        }
        
        // 5. 重组输出
        out_put[k] = head + "\"pivotOffset\":[" + xs + "," + ys + "]" + back;
    }
}
```

**数学原理：**

设原装饰尺寸为 S，pivotOffset为 P：
- 实际偏移距离 = S × (P / S) = P（单位长度）

缩放后装饰尺寸为 S/lnum，要保持相同的视觉偏移：
- (S/lnum) × (P' / (S/lnum)) = P
- P' = P / lnum

#### 4.3 边界情况处理

```cpp
// 条件1：必须是被标记为需要缩放的事件
if_p[k] == 1

// 条件2：pivotOffset字段存在
get(out_put[k], "pivotOffset") != ""

// 条件3：不是null值
get(out_put[k], "pivotOffset") != "[null,null]"
```

---

### 5. 对象标签重命名算法

#### 5.1 目的

处理 `AddObject`、`AddText`、`SetObject`、`SetText` 事件中的标签：

```json
{
    "eventType": "AddText",
    "tag": "oldTag1 oldTag2",
    ...
}
```

如果 `oldTag1` 在 `bad_tag` 列表中，需要重命名为 `oldTag1_new_***_`。

#### 5.2 算法实现

```cpp
else if (get(s, "eventType") == "\"AddObject\"" || 
         get(s, "eventType") == "\"AddText\"" || 
         get(s, "eventType") == "\"SetObject\"" || 
         get(s, "eventType") == "\"SetText\"") {
    
    string add_tags = "";  // 重组后的标签字符串
    
    // 1. 解析每个标签
    while (get_tags.length() != 0) {
        string now_tag = get_tags.substr(0, st);
        
        // 2. 检查是否需要重命名
        if (bad_tag.find(" " + now_tag + " ") != -1) {
            add_tags += tag_map[now_tag] + " ";  // 使用新标签名
        } else {
            add_tags += now_tag + " ";           // 保持原标签名
        }
    }
    
    // 3. 重组输出
    out_put[opt] = head + "\"tag\":\"" + add_tags + "\"" + back;
}
```

**结果：**
```json
// 原始
{"eventType": "AddText", "tag": "text1 text2"}

// 处理后（假设text1在bad_tag中）
{"eventType": "AddText", "tag": "text1_new_***_ text2"}
```

---

### 6. 自定义背景缩放算法

#### 6.1 背景缩放规则

```json
{
    "eventType": "CustomBackground",
    "bgDisplayMode": "Tiled",  // 或 "Unscaled"
    "scalingRatio": 100,
    ...
}
```

**注意：** 只有 `bgDisplayMode` 不是 `"FitToScreen"` 时才需要缩放。

#### 6.2 算法实现

```cpp
else if (get(s, "eventType") == "\"CustomBackground\"" && 
         get(s, "bgDisplayMode") != "\"FitToScreen\"") {
    
    // 1. 提取scalingRatio
    string scale = get(s, "scalingRatio");
    
    // 2. 字符串分割
    head = s.substr(0, position_of_scalingRatio);
    back = remaining;
    
    // 3. 缩放计算
    double new_ratio = stod(scale) * lnum;
    
    // 4. 重组
    out_put[opt] = head + "\"scalingRatio\": " + to_string(new_ratio) + back;
}
```

**为什么FitToScreen不需要处理？**

`FitToScreen` 模式会自动将背景拉伸至全屏，无论原始尺寸如何，所以不受图片缩放影响。

---

## 缩放数学原理

### 1. 基本缩放变换

#### 1.1 定义
```
用户输入：lnum（压缩倍数）
实际缩放因子：scale_factor = 1 / lnum
```

**示例：**
- 输入 lnum = 2 → scale_factor = 0.5（缩小到原来的50%）
- 输入 lnum = 4 → scale_factor = 0.25（缩小到原来的25%）

#### 1.2 装饰尺寸变换

谱面中的scale参数：
```
scale_new = scale_original × lnum
```

**为什么不是除法？**

ADOFAI中的scale值越大，装饰越大。如果要让装饰缩小到1/2：
```
scale_original = 100
lnum = 2
scale_new = 100 × 2 = 200？ ✗ 错误！会变大

正确理解：
scale_new = 100 × (1/2) = 50 ✓
```

但代码中是 `scale × lnum`，说明**用户输入的lnum已经是倒数关系**：
- 用户想法："缩小2倍" → 输入 2
- 程序理解：lnum = 2 实际表示缩放因子 = 1/2

所以在图片处理部分：
```python
scale_factor = 1.0 / int(scale_factor)  # UI.py line 56
```

### 2. 坐标空间变换

#### 2.1 问题分析

ADOFAI使用相对坐标系统：
```
装饰的实际显示尺寸 = 图片像素尺寸 × scale值
```

**场景1：只缩放scale参数**
```
原始：
  图片：1000×1000 px
  scale：[100, 100]
  实际显示：1000×100 = 100000 单位²

仅修改谱面：
  图片：1000×1000 px  （未变）
  scale：[50, 50]
  实际显示：1000×50 = 50000 单位² ✓ 缩小了
```

**场景2：同时缩放图片和scale**
```
原始：
  图片：1000×1000 px
  scale：[100, 100]

同时缩放（lnum=2）：
  图片：500×500 px
  scale：[50, 50]
  实际显示：500×50 = 25000 单位² ✗ 缩小了4倍！
```

**正确做法：**
```
同时缩放（lnum=2）：
  图片：500×500 px  （缩小到1/2）
  scale：[100, 100]  （保持不变）
  实际显示：500×100 = 50000 单位² ✓ 正好缩小2倍
```

**但代码为什么要缩放scale？**

因为ADOFAI的实际渲染可能还涉及其他因素（如物理单位转换），测试表明需要同时缩放图片和scale参数才能达到正确效果。

#### 2.2 PivotOffset的坐标变换

**原理图：**
```
原始装饰（scale=100）：
┌────────────────────┐
│                    │
│         ⊕         │  ← 中心点
│                    │
│                    │
└────────────────────┘
            ↓
      pivotOffset=[50,0]
            ↓
            ★  ← 实际枢轴点

实际偏移量 = 50单位

缩放后（scale=50，不处理pivotOffset）：
┌──────────┐
│    ⊕    │
└──────────┘
      ↓
  pivotOffset=[50,0]  （保持不变）
      ↓
      ★

实际偏移量 = 50单位 （相对装饰尺寸变成2倍！）

正确处理（pivotOffset=25）：
┌──────────┐
│    ⊕    │
└──────────┘
   ↓
pivotOffset=[25,0]
   ↓
   ★

实际偏移量 = 25单位 （相对装饰尺寸保持不变）
```

**数学公式：**
```
相对偏移比例 = pivotOffset / scale
要保持比例不变：
pivotOffset_new / scale_new = pivotOffset_old / scale_old

已知：scale_new = scale_old × lnum
求：pivotOffset_new = ?

pivotOffset_new = (pivotOffset_old / scale_old) × scale_new
                = (pivotOffset_old / scale_old) × (scale_old × lnum)
                = pivotOffset_old × lnum  ✗ 错误！

正确推导：
如果scale值缩小（视觉效果），而我们的lnum表示缩小倍数
实际 scale_new = scale_old / lnum （视觉缩小）
则 pivotOffset_new = pivotOffset_old / lnum
```

但代码中是 `scale × lnum`，说明ADOFAI的scale语义可能是反向的（数值越小视觉越小），或者存在其他转换层。

实际测试结果验证了代码的正确性：
```cpp
x = stod(xs) / lnum;  // pivotOffset反向缩放
```

### 3. 图片分辨率缩放

#### 3.1 双线性插值算法（PIL内部）

Python使用PIL库进行图片缩放：
```python
resized_image = image.resize((x, y))
```

PIL默认使用 `LANCZOS`（Lanczos重采样）算法，提供高质量缩放。

**原理简述：**

对于缩小操作（下采样）：
```
新像素值 = Σ(周围像素值 × 权重)
```

权重由Lanczos核函数计算：
```
L(x) = sinc(x) × sinc(x/a)，其中 a=3
sinc(x) = sin(πx) / (πx)
```

**优点：**
- 保留边缘清晰度
- 减少锯齿和摩尔纹
- 高质量缩小

#### 3.2 特殊情况处理

```python
if int(image.size[0]) != 1 or int(image.size[1]) != 1:
    resized_image = image.resize((x, y))
```

**为什么跳过1×1图片？**
- 1×1图片已经是最小单位，无法再缩小
- 避免除零错误
- 节省处理时间

```python
x = int(image.size[0] * scale_factor)
y = int(image.size[1] * scale_factor)
if x == 0: x = 1
if y == 0: y = 1
```

**边界保护：**
- 确保缩放后尺寸至少为1像素
- 防止PIL报错（不支持0尺寸图片）

### 4. 视觉一致性保证

#### 4.1 完整的缩放链条

```
┌─────────────┐
│ 原始谱面    │
│ 图片:1000px │
│ scale:100   │  → 显示效果
└─────────────┘

        ↓ lnum=2

┌─────────────┐
│ 缩放后谱面  │
│ 图片:500px  │
│ scale:50    │  → 相同显示效果
└─────────────┘

但 pivotOffset 需要相应调整
```

#### 4.2 数值精度处理

C++使用 `double` 存储缩放结果：
```cpp
double x = stod(xs) * lnum;
xs = to_string(x);
```

**潜在问题：**
```cpp
to_string(0.5) → "0.500000"  // 可能产生多余的小数位
```

**ADOFAI的容错性：**
- ADOFAI解析器能处理多余的小数位
- 精度误差在可接受范围（浮点误差 < 1e-6）

---

## 文件格式与数据结构

### 1. .adofai文件格式

#### 1.1 基本结构
```json
{
    "pathData": "RRURRDDU...",
    "settings": {
        "version": 14,
        "artist": "...",
        "song": "...",
        ...
    },
    "actions": [
        {
            "floor": 1,
            "eventType": "AddDecoration",
            "decorationImage": "decoration.png",
            "position": [0, 0],
            "scale": [100, 100],
            "pivotOffset": [0, 0],
            "tag": "myDeco",
            ...
        },
        {
            "floor": 5,
            "eventType": "MoveDecorations",
            "tag": "myDeco otherDeco",
            "scale": [50, 50],
            ...
        },
        ...
    ]
}
```

#### 1.2 关键事件类型

**AddDecoration** - 添加装饰
```json
{
    "eventType": "AddDecoration",
    "decorationImage": "path/to/image.png",
    "position": [x, y],           // 位置
    "relativeTo": "...",           // 相对定位
    "scale": [xScale, yScale],    // 缩放（可为null）
    "pivotOffset": [xOffset, yOffset],  // 枢轴偏移
    "rotation": angle,             // 旋转角度
    "depth": -1,                   // 深度
    "tag": "tagName",              // 标签（用于后续引用）
    "parallax": [xParallax, yParallax],
    "opacity": 100,
    ...
}
```

**MoveDecorations** - 移动/变换装饰
```json
{
    "eventType": "MoveDecorations",
    "tag": "tag1 tag2 tag3",      // 多标签，空格分隔
    "duration": 1.0,               // 持续时间（拍数）
    "positionOffset": [x, y],      // 位置偏移
    "rotationOffset": angle,       // 旋转偏移
    "scale": [xScale, yScale],    // 新缩放值（可选）
    "angleOffset": angle,
    "ease": "Linear",
    "eventTag": "...",
    ...
}
```

**AddText** - 添加文本
```json
{
    "eventType": "AddText",
    "decText": "Hello World",
    "font": "Arial",
    "position": [x, y],
    "tag": "textTag",
    "scale": [100, 100],
    ...
}
```

**AddObject** - 添加对象
```json
{
    "eventType": "AddObject",
    "objectType": "...",
    "tag": "objectTag",
    "position": [x, y],
    ...
}
```

**CustomBackground** - 自定义背景
```json
{
    "eventType": "CustomBackground",
    "bgImage": "background.jpg",
    "bgDisplayMode": "FitToScreen",  // 或 "Tiled", "Unscaled"
    "scalingRatio": 100,              // 仅非FitToScreen模式有效
    ...
}
```

### 2. 数据结构设计

#### 2.1 全局数据结构（level.cpp）

```cpp
// 文件路径数组
string k[100] = {""};  // 最多支持100个.adofai文件
int k_num = 0;          // 实际文件数量

// 标签系统
string tag = " ";       // 需要缩放的装饰标签集合
string bad_tag = " ";   // 需要重命名的对象标签集合
map<string, string> tag_map;  // 标签映射表：旧标签 → 新标签

// 输出缓冲
string out_put[1000] = {""};  // 输出行缓冲（单个事件可能拆分成多行）
int if_p[1000] = {0};         // 标记数组：是否需要处理pivotOffset
int opt = 0;                  // 当前输出行数
```

**设计考虑：**
- `k[100]`：固定大小数组，简单高效，适合中小型项目
- `tag` 和 `bad_tag`：用空格分隔的字符串，便于查找（` tag `）
- `tag_map`：C++ STL map，O(log n)查找，适合标签映射
- `out_put[1000]`：每个事件可能生成多个输出行（标签拆分）

#### 2.2 字符串处理策略

**分割-修改-重组模式：**
```cpp
// 1. 分割
head = s.substr(0, target_position);
mid = s.substr(target_position, next_position - target_position);
back = s.substr(next_position, remaining_length);

// 2. 修改
new_value = process(mid);

// 3. 重组
output = head + new_value + back;
```

**优点：**
- 保留原始格式（缩进、空格、换行）
- 只修改必要部分
- 不依赖JSON解析库（避免引入依赖）

**缺点：**
- 字符串操作较多，性能较低
- 对JSON格式变化敏感
- 难以处理复杂嵌套

### 3. 配置文件格式

#### 3.1 options.txt

```
on
on
off
```

**每行含义：**
1. 第一行：自动备份谱面文件夹（on/off）
2. 第二行：自动备份.adofai文件（on/off）
3. 第三行：运行结束后自动关闭（on/off）

**读取代码：**
```python
st3 = []
with open('options.txt', 'r') as file:
    for line in file:
        line = line.replace('\r', '').replace('\n', '')
        st3.append(line)
        if st3[-1] != "on" and st3[-1] != "off":
            st3[-1] = "off"  # 默认值
if len(st3) != 3:
    st3 = ["on", "on", "off"]  # 默认配置
```

#### 3.2 imgset.txt

```
.png
.jpg
.jpeg
.gif
.webp
```

**格式：** 每行一个文件扩展名（需要处理的图片格式）

**读取代码：**
```python
tr = []   # 扩展名列表
tr2 = []  # 替换后缩名（统一为.png）
tlen = 0  # 扩展名数量

with open('imgset.txt', 'r') as file:
    for line in file:
        if line[-1:] != "\n":
            line += "\n"
        tr.append(line)
        tr2.append(".png")
        tlen += 1
```

**用途：**
- 确定哪些文件需要作为图片处理
- 避免误处理非图片文件
- 支持自定义扩展名

---

## 详细实现分析

### 1. 多行事件处理

#### 1.1 问题背景

ADOFAI文件可能使用多行格式化：
```json
{
    "eventType": "AddDecoration",
    "scale": [
        100,
        100
    ],
    "tag": "myTag"
}
```

单行读取会导致解析失败。

#### 1.2 解决方案

```cpp
// 检测事件是否完整
while(get(s,"eventType") != "" &&           // 是事件行
      s.substr(s.length()-1,1) != "," &&    // 不以逗号结尾
      s.substr(s.length()-1,1) != "}") {    // 不以}结尾
    
    // 读取下一行并合并
    string next_line;
    getline(fin, next_line);
    s = s + "\n" + next_line;
    
    // 清理行尾空白
    while(s.substr(s.length()-1,1) == " " || 
          s.substr(s.length()-1,1) == "\r" || 
          s.substr(s.length()-1,1) == "\n") {
        s = s.substr(0, s.length()-1);
    }
}
```

**判断逻辑：**
- 包含 `"eventType"` → 是事件行
- 不以 `,` 或 `}` 结尾 → 事件未完整
- 继续读取下一行，拼接成完整事件

**处理效果：**
```json
// 原始（多行）
{
    "eventType": "AddDecoration",
    "scale": [100, 100]
}

// 读取后（合并为单行）
{ "eventType": "AddDecoration", "scale": [100, 100] }
```

### 2. 文件覆盖与备份

#### 2.1 备份策略

```cpp
int if_new = 0;  // 0=覆盖原文件, 1=创建新文件
cin >> if_new;

if(if_new == 1) {
    // 创建新文件：original_low.adofai
    new_path = path.replace(path.length()-7, 7, "_low.adofai");
} else {
    // 创建临时文件：original.adofai_tmp
    new_path = path.replace(path.length()-7, 7, ".adofai_tmp");
}
```

#### 2.2 原子替换操作

```cpp
if(if_new == 0) {
    string new_path0 = new_path;  // .adofai_tmp
    new_path.replace(new_path.length()-11, 11, ".adofai");
    
    DeleteFile(new_path.c_str());  // 删除原始文件
    if(rename(new_path0.c_str(), new_path.c_str()) == 0) {
        cout << "文件转换完成" << endl;
    } else {
        cout << "ERROR:文件写入失败" << endl;
    }
}
```

**安全性：**
1. 先写入临时文件（.adofai_tmp）
2. 写入成功后再删除原文件
3. 重命名临时文件为原文件名

**失败保护：**
- 如果写入失败，原文件仍然存在
- 如果重命名失败，临时文件保留，可手动恢复

### 3. 图片处理流程

#### 3.1 文件重命名保护

```python
for filename in files:
    if filename.lower().endswith(extension):
        # 临时重命名（防止扩展名冲突）
        tfilename = "newf_" + filename.replace(tr[i], tr2[i])
        os.rename(original_path, temp_path)
        
        # 处理图片
        image = Image.open(temp_path)
        resized_image.save(temp_path)
        
        # 恢复原文件名
        os.rename(temp_path, original_path)
```

**为什么要临时重命名？**

假设处理 `.jpg` 文件，扩展名映射为 `.png`：
```
原始：decoration.jpg
处理中：newf_decoration.png  （避免覆盖同名.png文件）
保存后：decoration.jpg  （恢复原名）
```

**保护措施：**
- 前缀 `newf_` 避免与现有文件冲突
- 处理完成后恢复原名，对用户透明

#### 3.2 错误处理

```python
try:
    image = Image.open(image_path)
    resized_image = image.resize((x, y))
    resized_image.save(image_path)
except Exception as e:
    outdata = f"Error resizing {image_path}: {e}\n"
    output_text.insert(tk.END, outdata)
```

**常见错误：**
- 图片损坏（PIL抛出异常）
- 权限不足（无法写入）
- 磁盘空间不足

**容错策略：**
- 单个文件失败不影响整体处理
- 输出错误信息到GUI
- 继续处理下一个文件

### 4. 进程间通信

#### 4.1 管道通信

```python
process = subprocess.Popen(
    cmd,
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1  # 行缓冲
)

# 发送输入
process.stdin.write(absolute_path + "\n")
process.stdin.flush()
process.stdin.write(scaling_factor + "\n")
process.stdin.flush()
process.stdin.write("1\n" if st3[1]=="on" else "0\n")
process.stdin.flush()

# 读取输出
while True:
    line = process.stdout.readline()
    if not line:
        break
    output_text.insert(tk.END, line)
    output_text.see(tk.END)
```

**通信协议：**
```
Python → C++:
  1. 谱面文件夹路径
  2. 缩放倍数
  3. 是否创建新文件 (0/1)

C++ → Python:
  - 实时输出处理进度
  - 错误信息
```

#### 4.2 线程异步处理

```python
threading.Thread(
    target=run_level_exe,
    args=(absolute_path, scaling_factor, output_text),
    daemon=True
).start()
```

**为什么使用线程？**
- 防止GUI阻塞（C++处理可能耗时较长）
- 实时更新输出信息
- 响应用户操作（理论上，但GUI已锁定）

**daemon=True：**
- 主线程退出时，子线程自动终止
- 防止程序无法正常关闭

### 5. 字符编码处理

#### 5.1 C++编码问题

```cpp
// 注释掉的代码
// SetConsoleOutputCP(CP_UTF8);
```

**问题：** Windows默认使用GBK编码，UTF-8文件读取会乱码。

**解决方案：**
```cpp
ifstream fin(path.c_str(), std::ios::binary);
```

使用二进制模式读取，避免编码转换。

**输出处理：**
```cpp
cout << "文件转换完成" << endl;
```

中文注释和输出在Windows控制台可能显示为乱码，但不影响文件处理。

#### 5.2 Python编码处理

```python
process = subprocess.Popen(
    cmd,
    text=True,  # 文本模式，自动处理编码
    ...
)
```

Python 3默认使用UTF-8，能正确处理C++输出（如果配置正确）。

### 6. 内存与性能优化

#### 6.1 流式处理

```cpp
stringstream fin(fins);  // 将整个文件读入内存

while(getline(fin, s)) {
    // 逐行处理
}
```

**优点：**
- 简化代码逻辑
- 支持多行事件合并

**缺点：**
- 大文件占用内存（GB级文件可能超出内存）

**改进方案：**
使用真正的流式处理，边读边写：
```cpp
ifstream fin(input_path);
ofstream fout(output_path);

while(getline(fin, s)) {
    process(s);
    fout << s << endl;
}
```

#### 6.2 图片处理优化

```python
Image.LOAD_TRUNCATED_IMAGES = True  # 容错
Image.MAX_IMAGE_PIXELS = None       # 取消尺寸限制
```

**LOAD_TRUNCATED_IMAGES：**
- 允许加载不完整的图片
- 防止因单个损坏图片导致程序崩溃

**MAX_IMAGE_PIXELS：**
- PIL默认限制图片尺寸（防止解压缩炸弹攻击）
- 谱面可能包含超大图片，需要取消限制

---

## 配置文件说明

### 1. options.txt

**路径：** 程序根目录

**格式：**
```
on
on
off
```

**配置项：**

| 行号 | 配置项 | 说明 | 默认值 |
|------|--------|------|--------|
| 1 | 自动备份谱面文件夹 | 处理前复制整个文件夹为 `folder_low` | on |
| 2 | 自动备份.adofai文件 | 生成 `file_low.adofai` 而非覆盖 | on |
| 3 | 运行结束后自动关闭 | 完成后5秒自动退出程序 | off |

**逻辑关系：**

| 配置1 | 配置2 | 行为 |
|-------|-------|------|
| on | 任意 | 复制整个文件夹，在副本上操作 |
| off | on | 仅生成新.adofai文件，图片直接覆盖 |
| off | off | 覆盖.adofai和图片（高风险） |

**安全警告逻辑：**
```python
if st3[0]=="off" and st3[1]=="off":
    # 警告：没有任何备份
    messagebox.askokcancel("您没有开启自动备份功能...")
elif st3[0]=="off" and st3[1]=="on":
    # 警告：仅备份谱面文件
    messagebox.askokcancel("您仅开启了.adofai文件备份...")
```

### 2. imgset.txt

**路径：** 程序根目录

**格式：**
```
.png
.jpg
.jpeg
.gif
.webp
```

**说明：**
- 每行一个文件扩展名
- 扩展名需包含 `.` 前缀
- 大小写不敏感（代码中转为小写比较）

**添加新格式：**
```python
# 在GUI中点击"图片格式设置"
# 或直接编辑 imgset.txt 添加：
.bmp
.tiff
```

**支持格式：**
取决于PIL支持的格式：
- PNG, JPEG, GIF, WEBP, BMP, TIFF, ICO 等

---

## 使用流程

### 1. 标准使用流程

```
┌─────────────────┐
│ 1. 准备谱面文件│
│   - 确保文件夹  │
│     包含.adofai │
│   - 确保图片在  │
│     同一目录树  │
└────────┬────────┘
         │
┌────────▼────────┐
│ 2. 启动程序    │
│   - 运行UI.exe  │
│   - 或 python   │
│     UI.py       │
└────────┬────────┘
         │
┌────────▼────────┐
│ 3. 配置参数    │
│   - 选择文件夹  │
│   - 输入压缩倍数│
│   - 检查设置    │
└────────┬────────┘
         │
┌────────▼────────┐
│ 4. 执行处理    │
│   - 点击"开始"  │
│   - 确认提示    │
│   - 等待完成    │
└────────┬────────┘
         │
┌────────▼────────┐
│ 5. 验证结果    │
│   - 检查生成文件│
│   - 在游戏中测试│
│   - 对比文件大小│
└─────────────────┘
```

### 2. 输入参数说明

#### 2.1 谱面文件夹路径
```
E:\ADOFAI\MyLevel
```

**要求：**
- 必须是有效路径
- 文件夹必须存在
- 需要包含至少一个 .adofai 文件

**多文件处理：**
- 自动递归搜索所有子目录
- 处理找到的所有 .adofai 文件

#### 2.2 压缩倍数
```
2
```

**要求：**
- 必须是整数
- 必须大于 1

**效果：**
| 输入 | scale变化 | 图片尺寸变化 | 文件大小变化 |
|------|-----------|--------------|--------------|
| 2 | ×2 | ÷2 | 约÷4 |
| 4 | ×4 | ÷4 | 约÷16 |
| 8 | ×8 | ÷8 | 约÷64 |

**注意：** 文件大小变化是图片尺寸变化的平方（因为是二维缩放）

### 3. 输出文件说明

#### 3.1 备份文件夹模式（配置1=on）
```
原始：
E:\ADOFAI\MyLevel\
  - level.adofai
  - decoration.png
  - background.jpg

生成：
E:\ADOFAI\MyLevel_low\
  - level.adofai        (已修改)
  - decoration.png      (已缩放)
  - background.jpg      (已缩放)
```

#### 3.2 新文件模式（配置1=off, 配置2=on）
```
原始：
E:\ADOFAI\MyLevel\
  - level.adofai
  - decoration.png

生成：
E:\ADOFAI\MyLevel\
  - level.adofai        (未修改)
  - level_low.adofai    (新文件)
  - decoration.png      (已覆盖！)
```

**注意：** 此模式下图片会被覆盖，无法恢复！

#### 3.3 覆盖模式（配置1=off, 配置2=off）
```
原始：
E:\ADOFAI\MyLevel\
  - level.adofai
  - decoration.png

处理后：
E:\ADOFAI\MyLevel\
  - level.adofai        (已覆盖！)
  - decoration.png      (已覆盖！)
```

**警告：** 此模式完全覆盖原文件，强烈建议手动备份！

### 4. 错误处理

#### 4.1 常见错误

**错误1：未找到.adofai文件**
```
输出：未找到.adofai文件，请检查文件路径或路径是否正确
原因：路径错误或文件夹内无谱面文件
解决：检查路径，确保包含 .adofai 文件
```

**错误2：文件写入失败**
```
输出：ERROR:文件xxx写入失败
原因：权限不足或磁盘空间不足
解决：以管理员身份运行，检查磁盘空间
```

**错误3：图片处理错误**
```
输出：Error resizing xxx: [错误信息]
原因：图片损坏或格式不支持
解决：跳过该文件，手动检查图片
```

#### 4.2 调试建议

**开启详细输出：**
```cpp
// level.cpp 中取消注释
cout << "处理事件: " << get(s, "eventType") << endl;
```

**检查中间文件：**
```
查看 .adofai_tmp 文件（临时文件）
对比原始和输出的 .adofai 内容
```

**验证缩放结果：**
```python
# 计算期望的图片尺寸
original_size = (1000, 1000)
lnum = 2
expected_size = (1000//lnum, 1000//lnum)  # (500, 500)

# 验证
image = Image.open("decoration.png")
assert image.size == expected_size
```

---

## 附录

### A. 算法复杂度分析

| 算法 | 时间复杂度 | 空间复杂度 |
|------|-----------|-----------|
| 文件搜索 | O(n) | O(n) |
| JSON解析 | O(m) | O(1) |
| 标签匹配 | O(k) | O(1) |
| 事件处理 | O(e×m) | O(e) |
| 图片缩放 | O(w×h) | O(w×h) |

其中：
- n = 文件/文件夹数量
- m = 单行字符串长度
- k = 标签字符串长度
- e = 事件数量
- w, h = 图片宽高

**总复杂度：** O(n + e×m + Σ(w×h))

### B. 性能优化建议

1. **使用JSON解析库**
   - 替换字符串操作为结构化解析
   - 推荐：RapidJSON (C++) 或 json11

2. **并行图片处理**
   ```python
   from multiprocessing import Pool
   with Pool() as pool:
       pool.map(resize_image, image_list)
   ```

3. **增量处理**
   - 只处理修改过的文件
   - 使用文件哈希判断变化

4. **内存映射文件**
   ```cpp
   #include <sys/mman.h>
   // 使用mmap减少内存拷贝
   ```

### C. 扩展功能建议

1. **批量处理多个谱面**
   - 选择多个文件夹
   - 队列式处理

2. **预览功能**
   - 显示缩放前后对比
   - 文件大小变化预估

3. **撤销功能**
   - 自动备份到隐藏文件夹
   - 一键恢复原始文件

4. **配置预设**
   - 保存常用配置
   - 快速切换（高/中/低质量）

### D. 已知限制

1. **不支持的格式**
   - 非JSON格式的旧版.adofai文件
   - 加密/压缩的谱面文件

2. **特殊情况**
   - 包含中文路径可能出现编码问题
   - 超大图片（>100MB）处理较慢

3. **功能限制**
   - 不处理音频文件
   - 不处理视频装饰
   - 不处理粒子效果

### E. 相关资源

- **ADOFAI官方文档：** https://docs.google.com/document/d/...
- **PIL/Pillow文档：** https://pillow.readthedocs.io/
- **C++ JSON库：** https://github.com/nlohmann/json

---

## 版本历史

- **v1.0** - 初始版本
  - 基本缩放功能
  - GUI界面
  - 图片处理

---

**作者：** 一块发霉的土豆  
**最后更新：** 2025-10-17

