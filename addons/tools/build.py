s=open('base.html',encoding='utf-8').read()
a=s.index('<script type="module" crossorigin>')+len('<script type="module" crossorigin>')
b=s.index('</script>',a)
js=open('app.mod.js',encoding='utf-8').read()
assert '</script' not in js.lower(), 'raw close tag'
out=s[:a]+js+s[b:]
open('index.html','w',encoding='utf-8').write(out)
print(len(out))
