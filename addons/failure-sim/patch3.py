import sys
s=open('/home/claude/vid/art_patched2.html',encoding='utf-8').read()
def rep(old,new,count=1):
    global s
    n=s.count(old)
    if n!=count: sys.exit(f'count {n}!={count}: {old[:90]!r}')
    s=s.replace(old,new)

# A. pump: non-return valve (reverse flow blocked)
rep('_ = 1.2 * w * h * h - 0.2 * w * (p / y) ** 2,',
    '_ = 1.2 * w * h * h - 0.2 * w * (p / y) ** 2 - (p < 0 ? 40 * w * (p / y) : 0),')
# B. CDU secondary pump: same
rep('''              1.2 * d("H_rated") * g * g -
              0.2 * d("H_rated") * (y / d("m_rated")) ** 2,''',
    '''              1.2 * d("H_rated") * g * g -
              0.2 * d("H_rated") * (y / d("m_rated")) ** 2 -
              (y < 0 ? 40 * d("H_rated") * (y / d("m_rated")) : 0),''')
# C. pipe: leak + clog (live parameters, read each iteration)
rep('''        mat: d.material,
        ins: h("ins_mm") / 1e3,
      });''','''        mat: d.material,
        ins: h("ins_mm") / 1e3,
        leak: () => d.leak_mm || 0,
        clog: () => d.clog_pct || 0,
      });''')
rep('{ D: a, t: c, L: d, K: h, dz: p, ins: g } = t,','{ D: a, t: c, L: d, K: h, dz: p, ins: g, leak: LKf, clog: CLf } = t,')
rep('be = gM(N, ae, me, a, d, o.rough, h),',
    'be = gM(N, ae, me, a, d, o.rough, h + ((c0) => (c0 > 0 ? (1 / (0.62 * (1 - c0)) - 1) ** 2 : 0))(Math.min(CLf ? CLf() : 0, 99.5) / 100)),')
rep('''      const se = O(U, W);
      ((N[B] = (U[n.m] - U[r.m]) / H),''','''      const se = O(U, W);
      ((N[B] = (U[n.m] - U[r.m] - fxLeakM(LKf, se)) / H),''')
rep('''        flow_m3h: (N.m / N.rho) * 3600,
      };
    },
  };
}
const MM = (i) => [''','''        flow_m3h: (N.m / N.rho) * 3600,
        leak_kgs: fxLeakM(LKf, N),
        clog_pct: CLf ? CLf() : 0,
      };
    },
  };
}
function fxLeakM(LKf, se) {
  const dl = LKf ? LKf() : 0;
  if (dl <= 0) return 0;
  const A = (Math.PI * (dl / 1e3) ** 2) / 4;
  return 0.62 * A * Math.sqrt(2 * se.rho * Math.max(se.Pm - 101.325, 0) * 1e3);
}
const MM = (i) => [''')
# pipe params (Failure group)
rep('''      O1("flip", "Swap horizontal leg order (X↔Z)", !1, "Route"),
      ze("elev", "Extra route elevation", "m", 0, -3, 10, 0.05, "Route"),''','''      O1("flip", "Swap horizontal leg order (X↔Z)", !1, "Route"),
      ze("elev", "Extra route elevation", "m", 0, -3, 10, 0.05, "Route"),
      ze("leak_mm", "Leak hole diameter (failure)", "mm", 0, 0, 50, 0.1, "Failure"),
      ze("clog_pct", "Flow-area blockage (failure)", "%", 0, 0, 99, 1, "Failure"),''')
rep('function Ek({ c: i }) {','function Ek({ c: i, unit: unitB }) {')
rep('rate: () => ((e()?.speed ?? 0) / 100) * 18,\n        children: Array.from({ length: 6 }, (o, a) =>\n          x.jsx(\n            st,\n            {\n              s: [0.02, 0.15, 0.015],','rate: () => fxRate(i, unitB, e()?.speed),\n        children: Array.from({ length: 6 }, (o, a) =>\n          x.jsx(\n            st,\n            {\n              s: [0.02, 0.15, 0.015],')
rep('    pump: Ek,\n','    pump: NXM_pumpSet,\n')
fx=open('/home/claude/vid/fx_core.js',encoding='utf-8').read()+'\n'+open('/home/claude/vid/fx_ui.js',encoding='utf-8').read()
assert '</script' not in fx.lower()
marker='\n</script>\n    <style rel="stylesheet" crossorigin>'
assert s.count(marker)==1
s=s.replace(marker,'\n/* === FAILURE ENGINE === */\n'+fx+marker)
open('/home/claude/vid/art_patched3.html','w',encoding='utf-8').write(s)
print('ok',len(s))
