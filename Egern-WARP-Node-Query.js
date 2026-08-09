const IPV4_TRACE_URLS = [
  'https://1.1.1.1/cdn-cgi/trace',
  'https://162.159.36.1/cdn-cgi/trace',
];
const IPV6_TRACE_URLS = [
  'https://[2606:4700:4700::1111]/cdn-cgi/trace',
];
const HOSTNAME_TRACE_URLS = [
  'https://cloudflare.com/cdn-cgi/trace',
  'https://www.cloudflare.com/cdn-cgi/trace',
  'https://cloudflare-dns.com/cdn-cgi/trace',
];

const TRACE_HEADERS = {
  'user-agent': '1.1.1.1/6.22',
  'cf-client-version': 'i-6.22-2308151957.1',
  accept: 'text/plain',
};

function parseTrace(body) {
  return Object.fromEntries(
    String(body || '')
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function failedTrace(error) {
  return {
    ip: '获取失败',
    loc: '获取失败',
    colo: '获取失败',
    warp: '获取失败',
    error: error instanceof Error ? error.message : String(error),
  };
}

async function queryTrace(ctx, urls, policy) {
  let lastError = new Error('没有可用的 Cloudflare trace 地址');

  for (const url of urls) {
    try {
      const options = {
        headers: TRACE_HEADERS,
        timeout: 10000,
        // The original Loon script queries Cloudflare trace by IP address.
        // Egern needs this for the IP certificate/SNI mismatch.
        insecureTls: true,
      };

      if (policy) options.policy = policy;

      const response = await ctx.http.get(url, options);
      const body = await response.text();

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = parseTrace(body);
      if (!result.ip) throw new Error('Cloudflare 返回内容为空');
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  return failedTrace(lastError);
}

function valueOrFallback(value) {
  return value && String(value).trim() ? String(value).trim() : '获取失败';
}

function textLine(label, value, color = '#FFFFFFDD') {
  return {
    type: 'text',
    text: `${label}: ${valueOrFallback(value)}`,
    font: { size: 'caption1' },
    textColor: color,
    maxLines: 1,
    minScale: 0.7,
  };
}

export default async function (ctx) {
  const env = ctx.env || {};
  const policy = String(env.POLICY || '').trim();
  const language = String(env.LANGUAGE || 'zh-Hans').trim();

  let [ipv4, ipv6] = await Promise.all([
    queryTrace(ctx, IPV4_TRACE_URLS, policy),
    queryTrace(ctx, IPV6_TRACE_URLS, policy),
  ]);

  // Some proxy chains return HTTP 404 for an HTTPS request whose authority is
  // an IP address. Retry IPv4 with Cloudflare's normal hostname so the
  // selected Egern policy can still be tested.
  if (ipv4.ip === '获取失败') {
    const hostnameTrace = await queryTrace(ctx, HOSTNAME_TRACE_URLS, policy);
    if (hostnameTrace.ip !== '获取失败') {
      ipv4 = { ...hostnameTrace, fallback: true };
    }
  }

  const isEnglish = language === 'en';
  const labels = isEnglish
    ? {
        title: 'WARP Info',
        policy: 'Policy',
        ipv4: 'IPv4',
        ipv6: 'IPv6',
        colo: 'Colo',
        warp: 'WARP',
        hint: 'Set POLICY in the module environment to test a specific node.',
      }
    : {
        title: 'WARP 节点信息',
        policy: '测试策略',
        ipv4: 'IPv4',
        ipv6: 'IPv6',
        colo: '托管中心',
        warp: '隐私保护',
        hint: '请在模块环境变量 POLICY 中填写要测试的节点名称。',
      };

  const colo = ipv4.colo !== '获取失败' ? ipv4.colo : ipv6.colo;
  const warp = ipv4.warp !== '获取失败' ? ipv4.warp : ipv6.warp;
  const selectedPolicy = policy || (isEnglish ? 'Egern default' : 'Egern 默认策略');

  const children = [
    {
      type: 'text',
      text: labels.title,
      font: { size: 'headline', weight: 'bold' },
      textColor: '#FFFFFF',
      maxLines: 1,
      minScale: 0.7,
    },
    textLine(labels.policy, selectedPolicy),
    textLine(labels.ipv4, ipv4.ip),
    textLine(labels.ipv6, ipv6.ip),
    textLine(labels.colo, colo),
    textLine(labels.warp, String(warp).toUpperCase()),
  ];

  if (!policy) {
    children.push({
      type: 'text',
      text: labels.hint,
      font: { size: 'caption2' },
      textColor: '#FFFFFF99',
      maxLines: 2,
      minScale: 0.65,
    });
  }

  if (ipv4.fallback) {
    children.push({
      type: 'text',
      text: isEnglish
        ? 'IPv4: Cloudflare hostname fallback used'
        : 'IPv4: 已使用 Cloudflare 域名回退查询',
      font: { size: 'caption2' },
      textColor: '#FFFFFF99',
      maxLines: 1,
      minScale: 0.6,
    });
  }

  const failed = isEnglish ? 'Request failed' : '请求失败';
  const errors = [ipv4.error, ipv6.error].filter(Boolean);
  if (errors.length && (ipv4.ip === '获取失败' || ipv6.ip === '获取失败')) {
    children.push({
      type: 'text',
      text: `${failed}: ${errors[0]}`,
      font: { size: 'caption2' },
      textColor: '#FFE0E0',
      maxLines: 2,
      minScale: 0.55,
    });
  }

  return {
    type: 'widget',
    children,
    gap: 5,
    padding: 14,
    backgroundColor: '#F6821F',
  };
}
