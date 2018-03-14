/*
   Remember: PRESENT =/= PAST.
   CURRENT STATE has no HISTORY.
   OK for computers -- bad for humans.
   If you cannot see history,
   you will repeat past mistakes.
   What follows is NOT a substitute for building up the system step-by-step.
*/

// Generated using describeInJavascript() - see orom.js
object(1);
state('id', dom('INPUT', '1'));
state('vtable', dom('INPUT', '1'));
state('parent', dom('INPUT', '2'));
state('name', dom('INPUT', 'vtable vtable'));
state('-addMethod', dom('INPUT', '4'));
state('-lookup', dom('INPUT', '5'));
state('-allocate', dom('INPUT', '6'));
state('-delegated', dom('INPUT', '8'));
object(2);
state('id', dom('INPUT', '2'));
state('vtable', dom('INPUT', '1'));
state('parent', dom('INPUT', '0'));
state('name', dom('INPUT', 'object vtable'));
state('-to-javascript', dom('INPUT', '11'));
state('-dom-node', dom('INPUT', '14'));
object(3);
state('id', dom('INPUT', '3'));
state('vtable', dom('INPUT', '1'));
state('parent', dom('INPUT', '1'));
state('name', dom('INPUT', 'JS function vtable'));
state('-init', dom('INPUT', '7'));
object(4);
state('id', dom('INPUT', '4'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'vtable.addMethod'));
state('code', dom('TEXTAREA', atob('ZnVuY3Rpb24ocmN2LCBuYW1lLCBpbXBsKSB7CiAgY29uc3Qgc3ltYm9sID0gJy0nK25hbWU7CiAgcmV0dXJuIHN0YXRlKHJjdiwgc3ltYm9sLCBzdGF0ZShpbXBsLCAnaWQnKSk7Cn0=')));
object(5);
state('id', dom('INPUT', '5'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'vtable.lookup'));
state('code', dom('TEXTAREA', atob('ZnVuY3Rpb24ocmN2LCBuYW1lKSB7CiAgY29uc3Qgc3ltYm9sID0gJy0nK25hbWU7CiAgY29uc3QgaW1wbCA9IHN0YXRlKHJjdiwgc3ltYm9sKTsKICBjb25zdCBwYXJlbnQgPSBzdGF0ZShyY3YsICdwYXJlbnQnKTsKICBpZiAoaW1wbCA9PT0gJzAnICYmIHBhcmVudCAhPT0gJzAnKQogICAgcmV0dXJuIHNlbmQoZGVyZWYocGFyZW50KSwgJ2xvb2t1cCcsIG5hbWUpOwogIGVsc2UKICAgIHJldHVybiBpbXBsOwp9')));
object(6);
state('id', dom('INPUT', '6'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'vtable.allocate'));
state('code', dom('TEXTAREA', atob('ZnVuY3Rpb24ocmN2KSB7CiAgbGV0IGVudCA9IG5ldyBFbnRpdHkoKTsKCiAgc3RhdGUoZW50LCAndnRhYmxlJywgc3RhdGUocmN2LCAnaWQnKSk7CiAgcmV0dXJuIGVudDsKfQ==')));
object(7);
state('id', dom('INPUT', '7'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'function.init'));
state('code', dom('TEXTAREA', atob('ZnVuY3Rpb24ocmN2LCBuYW1lLCBjb2RlKSB7CiAgc3RhdGUocmN2LCAnbmFtZScsIG5hbWUgfHwgJzxmdW5jdGlvbj4nKTsKICBzdGF0ZShyY3YsICdjb2RlJywgbXVsdGlsaW5lKGNvZGUgfHwgJygpID0+ICJ1bmltcGxlbWVudGVkIicpKTsKfQ==')));
object(8);
state('id', dom('INPUT', '8'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'vtable.delegated'));
state('code', dom('TEXTAREA', atob('ZnVuY3Rpb24ocmN2KSB7CiAgbGV0IG5ld1ZUID0gbmV3IEVudGl0eSgpOwogIAogIGlmIChyY3YgPT09ICcwJykgewogICAgc3RhdGUobmV3VlQsICd2dGFibGUnLCAnMCcpOwogICAgc3RhdGUobmV3VlQsICdwYXJlbnQnLCAnMCcpOwogIH0gZWxzZSB7CiAgICBzdGF0ZShuZXdWVCwgJ3Z0YWJsZScsIHN0YXRlKHJjdiwgJ3Z0YWJsZScpKTsKICAgIHN0YXRlKG5ld1ZULCAncGFyZW50Jywgc3RhdGUocmN2LCAnaWQnKSk7CiAgfQogIAogIHJldHVybiBuZXdWVDsKfQ==')));
object(9);
state('id', dom('INPUT', '9'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'bind'));
state('code', dom('TEXTAREA', atob('ZnVuY3Rpb24ocmN2LCBzZWxlY3RvcikgewogIGxldCBpbXBsOwogIGlmIChyY3YgPT09IHZ0YWJsZV92dCAmJiBzZWxlY3RvciA9PT0gJ2xvb2t1cCcpCiAgICBpbXBsID0gdnRhYmxlX2xvb2t1cChyY3YsIHNlbGVjdG9yKTsKICBlbHNlCiAgICBpbXBsID0gc2VuZChkZXJlZihzdGF0ZShyY3YsICd2dGFibGUnKSksICdsb29rdXAnLCBzZWxlY3Rvcik7CiAgaWYgKGltcGwgPT09ICcwJykKICAgIHRocm93IGBFbnRpdHkgJHtzdGF0ZShyY3YsICdpZCcpfSBkb2VzIG5vdCB1bmRlcnN0YW5kICR7c2VsZWN0b3J9YDsKICBlbHNlCiAgICByZXR1cm4gZGVyZWYoaW1wbCk7Cn0=')));
object(10);
state('id', dom('INPUT', '10'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'send'));
state('code', dom('TEXTAREA', atob('ZnVuY3Rpb24ocmN2LCBzZWxlY3RvciwgLi4uYXJncykgewogIGNvbnN0IGltcGwgPSBiaW5kKHJjdiwgc2VsZWN0b3IpOwogIHJldHVybiBjYWxsX2Z1bmMoaW1wbCwgcmN2LCAuLi5hcmdzKTsKfQ==')));
object(11);
state('id', dom('INPUT', '11'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'object.to-javascript'));
state('code', dom('TEXTAREA', atob('ZnVuY3Rpb24ocmN2KSB7CiAgbGV0IHRycyA9IHJjdi5zdGF0ZVRhYi5xdWVyeVNlbGVjdG9yQWxsKCd0cicpOwogIGxldCBwYWlycyA9IEFycmF5LmZyb20odHJzKS5tYXAodHIgPT4gewogICAgbGV0IGtleSA9IHRyLmNsYXNzTmFtZTsKICAgIGxldCB2YWx1ZV9lbGVtID0gdHIucXVlcnlTZWxlY3RvcignLnZhbHVlJykuY2hpbGRyZW5bMF07CiAgICByZXR1cm4gW2tleSwgdmFsdWVfZWxlbV07CiAgfSk7CiAgbGV0IHN0YXRlX3NldHRlcnMgPSBwYWlycy5tYXAoKFtrLCB2ZWxlbV0pID0+IHsKICAgIGxldCB2YWx1ZV9qc19leHByID0gZG9tX3RvX2pzKHZlbGVtKTsKICAgIHJldHVybiBgc3RhdGUoJyR7a30nLCAke3ZhbHVlX2pzX2V4cHJ9KTtgOwogIH0pOwogIGxldCBwcmVhbWJsZSA9IGBvYmplY3QoJHtzdGF0ZShyY3YsICdpZCcpfSk7YDsKICBsZXQgY29kZSA9IHByZWFtYmxlICsgJ1xuJyArIHN0YXRlX3NldHRlcnMuam9pbignXG4nKTsKICByZXR1cm4gY29kZTsKfQ==')));
object(12);
state('id', dom('INPUT', '12'));
state('vtable', dom('INPUT', '1'));
state('parent', dom('INPUT', '1'));
state('name', dom('INPUT', 'mapping vtable'));
state('-init', dom('INPUT', '13'));
state('-dom-node', dom('INPUT', '15'));
object(13);
state('id', dom('INPUT', '13'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'mapping.init'));
state('code', dom('TEXTAREA', atob('ZnVuY3Rpb24obWFwcGluZywgaW5wdXQsIG91dHB1dCkgewogIHN0YXRlKG1hcHBpbmcsICdpbnB1dCcsIHN0YXRlKGlucHV0LCAnaWQnKSk7CiAgc3RhdGUobWFwcGluZywgJ291dHB1dCcsIHN0YXRlKG91dHB1dCwgJ2lkJykpOwp9')));
object(14);
state('id', dom('INPUT', '14'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'object.dom-node'));
state('code', dom('TEXTAREA', atob('ZnVuY3Rpb24ob2JqZWN0LCBzZW5kZXIpIHsKICBpZiAoc2VuZGVyICE9PSB1bmRlZmluZWQpIHsKICAgIGxldCB0ZXh0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYicpOwogICAgdGV4dC50ZXh0Q29udGVudCA9IHN0YXRlKG9iamVjdCwgJ2lkJyk7CiAgICByZXR1cm4gdGV4dDsKICB9IGVsc2UgewogICAgbGV0IHRtcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpOwogICAgdG1wLmNsYXNzTmFtZSA9ICdlbnRpdHknOwogICAgdG1wLnRleHRDb250ZW50ID0gc3RhdGUob2JqZWN0LCAnbmFtZScpIHx8IHN0YXRlKG9iamVjdCwgJ2lkJyk7CiAgICByZXR1cm4gdG1wOwogIH0KfQ==')));
object(15);
state('id', dom('INPUT', '15'));
state('vtable', dom('INPUT', '3'));
state('name', dom('INPUT', 'mapping.dom-node'));
state('code', dom('TEXTAREA', atob('ZnVuY3Rpb24obWFwcGluZykgewogIGxldCB0ciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJyk7CiAgbGV0IHRkX2luID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGQnKTsKICBsZXQgdGRfb3V0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGQnKTsKICB0ci5hcHBlbmRDaGlsZCh0ZF9pbik7CiAgdHIuYXBwZW5kQ2hpbGQodGRfb3V0KTsKICAKICB0ZF9pbi5hcHBlbmRDaGlsZChzZW5kKGRlcmVmKHN0YXRlKG1hcHBpbmcsICdpbnB1dCcpKSwgJ2RvbS1ub2RlJywgbWFwcGluZykpOwogIHRkX291dC5hcHBlbmRDaGlsZChzZW5kKGRlcmVmKHN0YXRlKG1hcHBpbmcsICdvdXRwdXQnKSksICdkb20tbm9kZScsIG1hcHBpbmcpKTsKCiAgcmV0dXJuIHRyOwp9')));
