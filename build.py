import re
r=lambda p: open('src/'+p).read()
css=r('style.css'); dark=r('dark.css').rstrip('\n')
css=css.replace('/*DARK*/',dark)
js=r('core.js')+'\n'+r('app1.js')+'\n'+r('app2.js')
js=js.replace('</script','<\\/script')
html=r('shell.html').replace('/*CSS*/',css).replace('/*JS*/',js)
open('index.html','w').write(html)
open('/tmp/present-all.js','w').write(js)
print('index.html', len(html), 'bytes')


