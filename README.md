# Loon-Rules
Loon Rules

## 老虎证券（Tiger Brokers）

[TigerBrokers.list](https://raw.githubusercontent.com/Echo777o/Loon-Rules/main/TigerBrokers.list) 为 Surge / Loon 文本规则集，仅包含用户截图中去重后的 15 个精确域名和 1 个 IPv4 地址，不扩大为整个主域名的后缀匹配。不限制截图中的端口，策略由配置文件指定。

Surge 的 `[Rule]` 引用示例：

```ini
RULE-SET,https://raw.githubusercontent.com/Echo777o/Loon-Rules/main/TigerBrokers.list,🌐 国外网站
```

请放在 `GEOIP,CN`、其他可能抢先匹配的宽泛规则及 `FINAL` 前面。
