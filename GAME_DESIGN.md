# 《兔子洞尽头》关卡设计

## 设计节奏

每章遵循“引入规则、练习规则、组合规则、反转规则”的渐进结构。灵感来自任天堂常用的可读性与教学节奏，但地图、角色、机关和叙事均为原创。

设计参考：

- Nintendo《Super Mario Bros. Wonder》开发访谈：每个关卡至少提供一次惊喜，并优先让关卡本身发生变化，而不是只把玩家传送到别处。
- SEGA《Super Monkey Ball》系列：倾斜、惯性、快速重试和逐步提高精度要求共同构成短关卡循环。

参考链接：

- https://www.nintendo.com/us/whatsnew/ask-the-developer-vol-11-super-mario-bros-wonder-part-1/
- https://www.nintendo.com/us/whatsnew/ask-the-developer-vol-11-super-mario-bros-wonder-part-3/
- https://www.sega.com/super-monkey-ball

1. `兔子洞没有底`：学习惯性、刹车和虚拟摇杆。
2. `门厅有许多门`：钥匙、尺寸与窄缝。
3. `眼泪汇成了海`：水流和检查点。
4. `你究竟是谁`：压力开关与故事分支。
5. `蘑菇森林`：变大、变小与重量机关。
6. `永远六点的茶会`：成对茶杯传送、轨道怀表与旋转茶桌。
7. `女王的花园`：先取得红漆，再按“安全展示、巡逻练习、窄路考验”依次染红三朵白玫瑰。
8. `镜子说反话`：女王花园后的镜中支线；三枚棋子依次切换镜门，旧路关闭、新路打开。
9. `女王的槌球场`：女王花园后的槌球支线；火烈鸟弹射器先展示方向力，再与顺序球门和纸牌巡逻组合。
10. `名字的审判`：两条后期支线重新汇合，将前述机关与旋转法庭组合成最终考验。

## 分支与存档

第三章后可以选择蘑菇森林或茶会；女王花园后可以选择镜中走廊或槌球场。每个分支点独立保存选择，解锁章节、最佳时间、死亡次数和当前章节保存在浏览器 `localStorage` 中。完成主线后，未走过的支线会在“梦境书签”中开放。

每章另藏一枚兔子浮雕。通关评价为一至三枚皇冠：三星需要在目标时间内零失误并找到浮雕；旧版 V2 存档会自动迁移到 V3，不丢失章节进度。

## 关卡数据约定

- 关卡使用稳定字符串 `id`，不要用数组下标作为存档键。
- `next` 和 `choices[].next` 必须引用有效关卡。
- 新机制优先通过关卡 JSON 字段表达，不把关卡特例写进 UI。
- 关键机关必须具备颜色之外的形状提示，确保小屏幕仍可辨认。
- 顺序谜题使用 `switchSequence`，轨道障碍使用 `path: "orbit"`，两者都必须通过数据测试。
- 动态房间使用 `rotators` 和 `requirements.rotations`，仅采用 90 度离散旋转以保证移动端碰撞稳定。
- 玫瑰染色使用 `paintables` 和 `requirements.painted`，染色检查点由 `checkpoint: true` 声明。
- 变形地图使用 `phases[].wallsByState` 和 `requirements.phases`；机关只切换离散状态，避免动画墙碰撞不确定。
- 每章使用 `story` 显示关前对白，关键收集物与机关可通过 `eventStories` 触发关中对白。
- 火烈鸟弹射使用 `bumpers`，速度向量由 `impulseX` / `impulseY` 定义；`targetHoopId` 将球槌与球门绑定，后续火烈鸟由 `requiresSwitches` 逐段唤醒。
- 槌球门使用 `requiresBumper` 校验最后一次有效击球，得分后打开对应 `gates`，不能再用普通移动绕过联动。
