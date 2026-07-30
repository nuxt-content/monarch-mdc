<script setup lang="ts">
const source = ref(`---
title: MDC syntax highlighter for Monaco Editor
repository: https://github.com/nuxtlabs/monarch-mdc
---

Integrate MDC syntax with Monaco Editor.

<!--
Inline :block
Inline :block[with content]
-->


# The "ı" character

The "ı" character

\`\`\`
code
\`\`\`

\`\`\`ts
const a = true
class B {
  private const b = true
}
\`\`\`

\`\`\`json
{
  "title": "Hello",
  "count": 3,
  "nested": { "ok": true }
}
\`\`\`

\`\`\`json-render
{
  "title": "Hello",
  "count": 3,
  "nested": { "ok": true }
}
\`\`\`

\`\`\`yaml-render
title: Hello
count: 3
nested:
  ok: true
\`\`\`

\`\`\`ts meta data
const a = true
class B {
  private const b = true
}
\`\`\`


\`\`\`ts [help]
const ts = "help"
const a = 3
class B {
  private const b = true
  // help
}
\`\`\`

\`\`\`ts {1,2}
const ts = "help"
const a = 3
class B {
  private const b = true
  // help
}
\`\`\`


\`\`\`ts {1,2} [filename]
const ts = "help"
const a = 3
class B {
  private const b = true
  // help
}
\`\`\`


\`\`\`ts [help] {1,3}
const ts = "help"
const a = 3
class B {
  private const b = true
  // help
}
\`\`\`

[Span]

[Span]{with="attribute"}

**bold**{with="attribute"}
__bold__{with="attribute"}

\`code\`{with="attribute"}

_italic_{with="attribute"}

[Link](#link){with="attribute"}

![image](#image){with="attribute"}

Inline :block

Inline :block[with content]

Inline :block[with content]{and="attributes"}
Inline :block{with="attributes"}[and content]

inline :block{with="attributes"}

::block{with="attributes"}
---
key: value
key2:
  - value
  - another value
---
This is **default slot**

#first_named_slot

# The Other slot

  ::child_block
    > child blockquote
  ::

#second-named-slot

The content
::

`)

useSeoMeta({
  ogImage: 'https://monarch-mdc.nuxt.dev/preview.png',
})

useHead({
  title: 'MDC syntax highlighter for Monaco Editor',
})
</script>

<template>
  <Editor
    v-model:code="source"
    class="h-screen w-screen"
  />
</template>

<style>
@import "tailwindcss";
@import "@nuxt/ui";
</style>
