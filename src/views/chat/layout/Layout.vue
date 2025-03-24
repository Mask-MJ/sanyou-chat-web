<script setup lang='ts'>
import type { Component } from 'vue'
import { computed, h } from 'vue'
import { NIcon, NLayout, NLayoutContent } from 'naive-ui'
import { useRouter } from 'vue-router'
import Sider from './sider/index.vue'
import Permission from './Permission.vue'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { useAppStore, useAuthStore, useChatStore, useUserStore } from '@/store'
import { t } from '@/locales'
// import { useChat } from '@/views/chat/hooks/useChat'

const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const chatStore = useChatStore()
const authStore = useAuthStore()

router.replace({ name: 'Chat', params: { uuid: chatStore.active } })

const { isMobile } = useBasicLayout()

const collapsed = computed(() => appStore.siderCollapsed)

const needPermission = computed(() => !!authStore.session?.auth && !authStore.token)

const getMobileClass = computed(() => {
  if (isMobile.value)
    return ['rounded-none', 'shadow-none']
  return ['border', 'rounded-md', 'shadow-md', 'dark:border-neutral-800']
})

const getContainerClass = computed(() => {
  return [
    'h-full',
    { 'pl-[260px]': !isMobile.value && !collapsed.value },
  ]
})
function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) })
}
const menuValue = computed(() => userStore.activeMenu)
const change = (value: string) => {
  // if (chatStore.uploading) return
  userStore.setActiveMenu(value)
  handleAdd()
}

function handleAdd() {
  chatStore.addHistory({ title: t('chat.newChatTitle'), uuid: Date.now(), isEdit: false, menuValue: userStore.activeMenu })
  if (isMobile.value)
    appStore.setSiderCollapsed(true)
}

// const menuOptions = [
//   {
//     label: '交互问答',
//     key: 'hear-the-wind-sing',
//     icon: renderIcon(ReadOutlined),
//     children: [
//       { label: '通用问答', key: '1', icon: renderIcon(AlertOutlined) },
//       {
//         label: '精准知识问答',
//         key: '2',
//         icon: renderIcon(AimOutlined),
//       },
//       // {
//       //   label: '搜索引擎问答',
//       //   key: '6',
//       //   icon: () => h('i', { class: 'i-ant-design:file-search-outlined' }),
//       // },
//     ],
//   },
//   {
//     label: '辅助工具',
//     key: 'pinball-1973',
//     icon: renderIcon(ProjectOutlined),
//     children: [
//       {
//         label: '辅助阅读专业文章',
//         key: '3',
//         icon: renderIcon(AuditOutlined),
//       },
//       {
//         label: '提炼文章核心内容',
//         key: '4',
//         icon: renderIcon(ClusterOutlined),
//       },
//       {
//         label: '专业文档翻译',
//         key: '5',
//         icon: renderIcon(ReconciliationOutlined),
//       },
//     ],
//   },
// ]
</script>

<template>
  <div class="h-full flex   dark:bg-[#24272e] text-neutral-900 dark:text-neutral-200">
    <!-- <NMenu :value="menuValue" :options="menuOptions" default-expand-all :indent="16" class="border-r-2 w-52" @update-value="change" /> -->
    <div class="h-full dark:bg-[#24272e] transition-all flex-1 bg-[#f0f2f5]">
      <div class="h-full overflow-hidden" :class="getMobileClass">
        <NLayout class="z-40 transition" :class="getContainerClass" has-sider>
          <Sider />
          <NLayoutContent class="h-full">
            <RouterView v-slot="{ Component, route }">
              <Component :is="Component" :key="route.fullPath" />
            </RouterView>
          </NLayoutContent>
        </NLayout>
      </div>
      <Permission :visible="needPermission" />
    </div>
  </div>
</template>
