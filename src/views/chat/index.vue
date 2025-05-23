<script setup lang='ts'>
import type { Ref } from 'vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import type { UploadFileInfo } from 'naive-ui'
import { NAutoComplete, NButton, NInput, NPopover, NUpload, useDialog, useMessage } from 'naive-ui'
import { toPng } from 'html-to-image'
import { UploadOutlined } from '@vicons/antd'
import type { AxiosProgressEvent } from 'axios'
import { Message } from './components'
import { useScroll } from './hooks/useScroll'
import { useChat } from './hooks/useChat'
import { useUsingContext } from './hooks/useUsingContext'
import HeaderComponent from './components/Header/index.vue'
import { SvgIcon } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { useChatStore, usePromptStore, useUserStore } from '@/store'
import { fetchChatAPIProcess4, fetchChatAPIProcess2, fetchChatAPIProcess3 } from '@/api'
import { t } from '@/locales'

let controller = new AbortController()

const openLongReply = import.meta.env.VITE_GLOB_OPEN_LONG_REPLY === 'true'

const route = useRoute()
const dialog = useDialog()
const ms = useMessage()

const chatStore = useChatStore()
const userStore = useUserStore()

const { isMobile } = useBasicLayout()
const { addChat, updateChat, updateChatSome, getChatByUuidAndIndex } = useChat()
const { scrollRef, scrollToBottom, scrollToBottomIfAtBottom } = useScroll()
const { usingContext } = useUsingContext()

const { uuid } = route.params as { uuid: string }

const dataSources = computed(() => chatStore.getChatByUuid(+uuid))
const conversationList = computed(() => dataSources.value.filter(item => (!item.inversion && !!item.conversationOptions)))
const menuValue = computed(() => userStore.activeMenu)

const prompt = ref<string>('')
const loading = ref<boolean>(false)
const inputRef = ref<Ref | null>(null)
const hasUpload = ref<boolean>(false)
const fileName = ref<string>('')

// 添加PromptStore
const promptStore = usePromptStore()

// 使用storeToRefs，保证store修改后，联想部分能够重新渲染
const { promptList: promptTemplate } = storeToRefs<any>(promptStore)

// 未知原因刷新页面，loading 状态不会重置，手动重置
dataSources.value.forEach((item, index) => {
  if (item.loading)
    updateChatSome(+uuid, index, { loading: false })
})

function handleSubmit() {
  onConversation()
}

const handleBeforeUpload = (data: { file: UploadFileInfo; fileList: UploadFileInfo[] }) => {
  const typeList = [
    'html',
    'md',
    'json',
    'csv',
    'pdf',
    'png',
    'jpg',
    'jpeg',
    'bmp',
    'eml',
    'msg',
    'rst',
    'rtf',
    'txt',
    'xml',
    'doc',
    'docx',
    'epub',
    'odt',
    'ppt',
    'pptx',
    'tsv',
    'htm',
  ]
  // 判断是否上传文件的后缀名是否在typeList中
  if (!typeList.includes(data.file.file?.name?.split('.').pop() || '')) {
    const typeName = typeList.join('、')
    window.$message?.error(`只能上传${typeName}格式的文件，请重新上传`)
    return false
  }

  loading.value = true
  // chatStore.setUploadStatus(true)
	fileName.value = data.file.file?.name || ''
  return true
}
const handleUploadFinish = (e: any) => {
  const { response } = e.event.target
  if (response) {
    const result = JSON.parse(response)
    if (result.code === 200) {
      hasUpload.value = true
      window.$message?.success('上传成功')
      chatStore.updateHistory(Number(uuid), {
        knowledge_id: result.data.id,
      })
      // chatStore.setDataByUuid({ uuid: props.uuid, pdf: e.file.file, knowledge_id: result.data.id })
    }
    loading.value = false
    userStore.setActiveMenu('3')
  }
  // chatStore.setUploadStatus(false)
}

async function onConversation() {
  let message = prompt.value

  if (loading.value)
    return

  if (!message || message.trim() === '')
    return

  controller = new AbortController()

  addChat(
    +uuid,
    {
      dateTime: new Date().toLocaleString(),
      text: message,
      inversion: true,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: null },
    },
  )
  scrollToBottom()

  loading.value = true
  prompt.value = ''

  let options: Chat.ConversationRequest = {}
  const lastContext = conversationList.value[conversationList.value.length - 1]?.conversationOptions

  if (lastContext && usingContext.value)
    options = { ...lastContext }

  addChat(
    +uuid,
    {
      dateTime: new Date().toLocaleString(),
      text: t('chat.thinking'),
      loading: true,
      inversion: false,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )
  scrollToBottom()

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
      let params: any = {
        url: '',
        prompt: message,
        options,
        signal: controller.signal,
        onDownloadProgress: ({ event }: AxiosProgressEvent) => {
          const xhr = event.target
          const { responseText } = xhr
          // Always process the final line
          try {
            const data = JSON.parse(responseText)
						const text = (data.choices[0].message.content as string)
            updateChat(
              +uuid,
              dataSources.value.length - 1,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + (text ?? ''),
                inversion: false,
                error: false,
                loading: true,
                conversationOptions: { conversationId: data.id, parentMessageId: data.id },
                requestOptions: { prompt: message, options: { ...options } },
              },
            )

            // if (openLongReply && data.detail.choices[0].finish_reason === 'length') {
            //   options.parentMessageId = data.id
            //   lastText = data.text
            //   message = ''
            //   return fetchChatAPIOnce()
            // }

            scrollToBottomIfAtBottom()
          }
          catch (error) {
          }
        },
      }
      if (menuValue.value === '1')
        await fetchChatAPIProcess4<Chat.ConversationResponse>(params).catch((error) => {
					console.log('error', error)
				})

      if (menuValue.value === '2') {
        params = {
          ...params,
          onDownloadProgress: ({ event }: AxiosProgressEvent) => {
            const xhr = event.target
            const { responseText } = xhr
            try {
              const data = JSON.parse(JSON.parse(responseText))
              updateChat(
                +uuid,
                dataSources.value.length - 1,
                {
                  dateTime: new Date().toLocaleString(),
                  text: data.choices[0].message.content || '',
                  inversion: false,
                  error: false,
                  loading: true,
                  conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                  requestOptions: { prompt: message, options: { ...options } },
                },
              )

              if (openLongReply && data.detail.choices[0].finish_reason === 'length') {
                options.parentMessageId = data.id
                lastText = data.text
                message = ''
                return fetchChatAPIOnce()
              }

              scrollToBottomIfAtBottom()
            }
            catch (error) {
            //
            }
          },
        }

        await fetchChatAPIProcess2<Chat.ConversationResponse>(params)
      }

      if (['3', '4', '5'].includes(menuValue.value)) {
        params = {
          ...params,
          onDownloadProgress: ({ event }: AxiosProgressEvent) => {
            const xhr = event.target
            const { responseText } = xhr
            try {
              const chunk = responseText.split('data: ')[1]
              const data = JSON.parse(chunk)
              const docs = data.docs.map((item: string) => `\n - ${item}`)
              updateChat(
                +uuid,
                dataSources.value.length - 1,
                {
                  dateTime: new Date().toLocaleString(),
                  text: `${data.answer}\n${docs}` || '',
                  inversion: false,
                  error: false,
                  loading: true,
                  conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                  requestOptions: { prompt: message, options: { ...options } },
                },
              )

              if (openLongReply && data.detail.choices[0].finish_reason === 'length') {
                options.parentMessageId = data.id
                lastText = data.text
                message = ''
                return fetchChatAPIOnce()
              }

              scrollToBottomIfAtBottom()
            }
            catch (error) {
            //
            }
          },
        }
        await fetchChatAPIProcess3<Chat.ConversationResponse>(params)
      }

			if (menuValue.value === '6') {
				params = {
          ...params,
          onDownloadProgress: ({ event }: AxiosProgressEvent) => {
            const xhr = event.target
            const { responseText } = xhr
            try {
              const data = JSON.parse(JSON.parse(responseText))
							console.log('data', data)
              updateChat(
                +uuid,
                dataSources.value.length - 1,
                {
                  dateTime: new Date().toLocaleString(),
                  text: data.choices[0].message.content || '',
                  inversion: false,
                  error: false,
                  loading: true,
                  conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                  requestOptions: { prompt: message, options: { ...options } },
                },
              )

              if (openLongReply && data.detail.choices[0].finish_reason === 'length') {
                options.parentMessageId = data.id
                lastText = data.text
                message = ''
                return fetchChatAPIOnce()
              }

              scrollToBottomIfAtBottom()
            }
            catch (error) {
            //
            }
          },
        }
				await fetchChatAPIProcess2<Chat.ConversationResponse>(params).catch((error) => {
					console.log('error', error)
				})
			}

      updateChatSome(+uuid, dataSources.value.length - 1, { loading: false })
    }

    await fetchChatAPIOnce()
  }
  catch (error: any) {
		console.log('error', error)
    const errorMessage = error?.message ?? t('common.wrong')

    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        dataSources.value.length - 1,
        {
          loading: false,
        },
      )
      scrollToBottomIfAtBottom()
      return
    }

    const currentChat = getChatByUuidAndIndex(+uuid, dataSources.value.length - 1)

    if (currentChat?.text && currentChat.text !== '') {
      updateChatSome(
        +uuid,
        dataSources.value.length - 1,
        {
          text: `${currentChat.text}\n[${errorMessage}]`,
          error: false,
          loading: false,
        },
      )
      return
    }

    updateChat(
      +uuid,
      dataSources.value.length - 1,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
    scrollToBottomIfAtBottom()
  }
  finally {
    loading.value = false
  }
}

async function onRegenerate(index: number) {
  if (loading.value)
    return

  controller = new AbortController()

  const { requestOptions } = dataSources.value[index]

  let message = requestOptions?.prompt ?? ''

  let options: Chat.ConversationRequest = {}

  if (requestOptions.options)
    options = { ...requestOptions.options }

  loading.value = true

  updateChat(
    +uuid,
    index,
    {
      dateTime: new Date().toLocaleString(),
      text: '',
      inversion: false,
      error: false,
      loading: true,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
      await fetchChatAPIProcess4<Chat.ConversationResponse>({
        prompt: message,
        options,
        signal: controller.signal,
				onDownloadProgress: ({ event }: AxiosProgressEvent) => {
          const xhr = event.target
          const { responseText } = xhr
          // Always process the final line
          try {
            const data = JSON.parse(responseText)
						const text = (data.choices[0].message.content as string)
            updateChat(
              +uuid,
              index,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + (text ?? ''),
                inversion: false,
                error: false,
                loading: true,
                conversationOptions: { conversationId: data.id, parentMessageId: data.id },
                requestOptions: { prompt: message, options: { ...options } },
              },
            )
          }
          catch (error) {
          }
        },
      }).catch((error) => {
				console.log('error', error)
			})
      updateChatSome(+uuid, index, { loading: false })
    }
    await fetchChatAPIOnce()
  }
  catch (error: any) {
    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        index,
        {
          loading: false,
        },
      )
      return
    }

    const errorMessage = error?.message ?? t('common.wrong')

    updateChat(
      +uuid,
      index,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
  }
  finally {
    loading.value = false
  }
}

function handleExport() {
  if (loading.value)
    return

  const d = dialog.warning({
    title: t('chat.exportImage'),
    content: t('chat.exportImageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: async () => {
      try {
        d.loading = true
        const ele = document.getElementById('image-wrapper')
        const imgUrl = await toPng(ele as HTMLDivElement)
        const tempLink = document.createElement('a')
        tempLink.style.display = 'none'
        tempLink.href = imgUrl
        tempLink.setAttribute('download', 'chat-shot.png')
        if (typeof tempLink.download === 'undefined')
          tempLink.setAttribute('target', '_blank')
        document.body.appendChild(tempLink)
        tempLink.click()
        document.body.removeChild(tempLink)
        window.URL.revokeObjectURL(imgUrl)
        d.loading = false
        ms.success(t('chat.exportSuccess'))
        Promise.resolve()
      }
      catch (error: any) {
        ms.error(t('chat.exportFailed'))
      }
      finally {
        d.loading = false
      }
    },
  })
}

function handleDelete(index: number) {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.deleteMessage'),
    content: t('chat.deleteMessageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.deleteChatByUuid(+uuid, index)
    },
  })
}

function handleClear() {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.clearChat'),
    content: t('chat.clearChatConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.clearChatByUuid(+uuid)
    },
  })
}

function handleEnter(event: KeyboardEvent) {
  if (!isMobile.value) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
  else {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
}

function handleStop() {
  if (loading.value) {
    controller.abort()
    loading.value = false
  }
}

// 可优化部分
// 搜索选项计算，这里使用value作为索引项，所以当出现重复value时渲染异常(多项同时出现选中效果)
// 理想状态下其实应该是key作为索引项,但官方的renderOption会出现问题，所以就需要value反renderLabel实现
const searchOptions = computed(() => {
  if (prompt.value.startsWith('/')) {
    return promptTemplate.value.filter((item: { key: string }) => item.key.toLowerCase().includes(prompt.value.substring(1).toLowerCase())).map((obj: { value: any }) => {
      return {
        label: obj.value,
        value: obj.value,
      }
    })
  }
  else {
    return []
  }
})

// value反渲染key
const renderOption = (option: { label: string }) => {
  for (const i of promptTemplate.value) {
    if (i.value === option.label)
      return [i.key]
  }
  return []
}

const placeholder = computed(() => {
  if (isMobile.value)
    return t('chat.placeholderMobile')
  return t('chat.placeholder')
})

const buttonDisabled = computed(() => {
  if (['3', '4', '5'].includes(menuValue.value)) {
    // 判断是否上传文件
    if (hasUpload.value)
      return loading.value || !prompt.value || prompt.value.trim() === ''
    else
      return true
  }
  else {
    return loading.value || !prompt.value || prompt.value.trim() === ''
  }
})

const buttonDisabled2 = computed(() => {
 return menuValue.value === '3'
})

const buttonDisabled3 = ref(false)

const buttonActive = ref(false)

const handleActive = ()=>{
	buttonActive.value = !buttonActive.value
	if (buttonActive.value) {
		userStore.setActiveMenu('6')
		window.$message?.success('关联知识库成功')
		buttonDisabled3.value = true
	}
	else {
		userStore.setActiveMenu('1')
		window.$message?.error('取消关联知识库')
		buttonDisabled3.value = false
	}
}

const footerClass = computed(() => {
  let classes = ['p-4']
  if (isMobile.value)
    classes = ['sticky', 'left-0', 'bottom-0', 'right-0', 'p-2', 'pr-3', 'overflow-hidden']
  return classes
})

onMounted(() => {
  scrollToBottom()
  if (inputRef.value && !isMobile.value)
    inputRef.value?.focus()
})

onUnmounted(() => {
  if (loading.value)
    controller.abort()
})
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <HeaderComponent
      v-if="isMobile"
      :using-context="usingContext"
      @export="handleExport"
      @handle-clear="handleClear"
    />
    <main class="flex-1 overflow-hidden">
      <div id="scrollRef" ref="scrollRef" class="h-full overflow-hidden overflow-y-auto">
        <div
          class="w-full max-w-screen-xl m-auto dark:bg-[#101014]"
          :class="[isMobile ? 'p-2' : 'p-4']"
        >
          <div id="image-wrapper" class="relative">
            <template v-if="!dataSources.length">
              <div class="flex items-center justify-center mt-40 text-center mb-4">
								<img class="w-12 mr-2" src="../../../public/xiaolan.jpg" alt="">
                <span class="text-2xl font-bold">我是 小兰，很高兴见到你！</span>
              </div>
							<div class="text-center">我可以帮你写代码、读文件、写作各种创意内容，请把你的任务交给我吧~</div>
            </template>
            <template v-else>
              <div>
                <Message
                  v-for="(item, index) of dataSources"
                  :key="index"
                  :date-time="item.dateTime"
                  :text="item.text"
                  :inversion="item.inversion"
                  :error="item.error"
                  :loading="item.loading"
                  @regenerate="onRegenerate(index)"
                  @delete="handleDelete(index)"
                />
                <div class="sticky bottom-0 left-0 flex justify-center">
                  <NButton v-if="loading" type="warning" @click="handleStop">
                    <template #icon>
                      <SvgIcon icon="ri:stop-circle-line" />
                    </template>
                    {{ t('common.stopResponding') }}
                  </NButton>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </main>
    <footer :class="footerClass">
			<div v-if="['3', '4', '5'].includes(menuValue)" class="mx-20 my-2">当前文件：{{ fileName }}</div>
      <div class=" m-auto mx-20 min-h-28 rounded-3xl bg-gray-100">
        <div class="flex items-center justify-between space-x-2">
          <!-- <HoverButton v-if="!isMobile" @click="handleClear">
            <span class="text-xl text-[#4f555e] dark:text-white">
              <SvgIcon icon="ri:delete-bin-line" />
            </span>
          </HoverButton>
          <HoverButton v-if="!isMobile" @click="handleExport">
            <span class="text-xl text-[#4f555e] dark:text-white">
              <SvgIcon icon="ri:download-2-line" />
            </span>
          </HoverButton>
          <HoverButton @click="toggleUsingContext">
            <span class="text-xl" :class="{ 'text-[#4b9e5f]': usingContext, 'text-[#a8071a]': !usingContext }">
              <SvgIcon icon="ri:chat-history-line" />
            </span>
          </HoverButton> -->
          <NAutoComplete v-model:value="prompt" :options="searchOptions" :render-label="renderOption">
            <template #default="{ handleInput, handleBlur, handleFocus }">
              <NInput
                ref="inputRef"
                v-model:value="prompt"
                class="message-input"
                type="textarea"
                :placeholder="placeholder"
                :autosize="{ minRows: 1, maxRows: isMobile ? 4 : 8 }"
                @input="handleInput"
                @focus="handleFocus"
                @blur="handleBlur"
                @keypress="handleEnter"
              />
            </template>
          </NAutoComplete>
					<NPopover trigger="hover">
            <template #trigger>
              <NButton class="!absolute bottom-8 left-28" :type="buttonActive ? 'primary': 'default' "  :disabled="buttonDisabled2" @click="handleActive">
								<!-- <template #icon>
									<SvgIcon icon="ri:question-line" />
								</template> -->
								关联知识库
              </NButton>
            </template>
            <span>请输入你的问题</span>
          </NPopover>
          <NPopover trigger="hover">
            <template #trigger>
              <NButton class="!absolute bottom-8 right-28" type="primary" circle :disabled="buttonDisabled" @click="handleSubmit">
                <template #icon>
                  <span class="dark:text-black text-white">
                    <SvgIcon icon="ri:send-plane-fill" />
                  </span>
                </template>
              </NButton>
            </template>
            <span>请输入你的问题</span>
          </NPopover>
          <NUpload
            class="!w-10 !absolute bottom-8 right-36"
            action="/knowledge_base/upload_temp_docs"
            name="files"
            :show-file-list="false"
            @before-upload="handleBeforeUpload"
            @finish="handleUploadFinish"
          >
            <NButton
              type="primary" :loading="loading"
              circle
							:disabled="buttonDisabled3"
            >
              <template #icon>
                <UploadOutlined />
              </template>
            </NButton>
          </NUpload>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped lang="css">
.message-input {
width: 100%;
min-height: 112px;
border: none !important;
color: inherit;
font-size: 1rem;
padding: 4px;
background-color: transparent !important;
}
.message-input :deep(.n-input__border) {
display: none !important;
}
.message-input.n-input--focus {
border: none !important;
}
.message-input :deep(.n-input__state-border) {
display: none !important;
}
</style>
