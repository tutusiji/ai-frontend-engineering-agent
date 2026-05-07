/**
 * UI Component Library Catalog
 *
 * Centralized registry of all supported UI component libraries.
 * Each entry defines: compatible frameworks, CDN URL, component naming
 * conventions, and key components for common patterns.
 */

export interface UiLibraryMeta {
  id: string;
  name: string;
  framework: 'vue3' | 'react' | 'both';
  npmPackage: string;
  cdnUrl?: string;
  description: string;
  strengths: string[];
  componentMap: Record<string, string>;
  formComponent: string;
  tableComponent: string;
  dialogComponent: string;
  messageComponent: string;
  iconPackage?: string;
  styling: string[];
}

export const UI_CATALOG: Record<string, UiLibraryMeta> = {
  'element-plus': {
    id: 'element-plus',
    name: 'Element Plus',
    framework: 'vue3',
    npmPackage: 'element-plus',
    cdnUrl: 'https://unpkg.com/element-plus',
    description: '最流行的 Vue3 管理后台 UI 库，饿了么出品，文档完善，中文生态最好',
    strengths: ['中文文档最完善', '管理后台标配', '表单/表格/弹窗组件最成熟', '社区活跃'],
    componentMap: {
      button: 'ElButton',
      input: 'ElInput',
      select: 'ElSelect',
      table: 'ElTable',
      TableColumn: 'ElTableColumn',
      form: 'ElForm',
      FormItem: 'ElFormItem',
      dialog: 'ElDialog',
      drawer: 'ElDrawer',
      pagination: 'ElPagination',
      tag: 'ElTag',
      badge: 'ElBadge',
      message: 'ElMessage',
      messagebox: 'ElMessageBox',
      loading: 'ElLoading',
      tabs: 'ElTabs',
      TabPane: 'ElTabPane',
      breadcrumb: 'ElBreadcrumb',
      menu: 'ElMenu',
      tree: 'ElTree',
      datepicker: 'ElDatePicker',
      upload: 'ElUpload',
      switch: 'ElSwitch',
      checkbox: 'ElCheckbox',
      radio: 'ElRadio',
      cascader: 'ElCascader',
      transfer: 'ElTransfer',
    },
    formComponent: 'ElForm',
    tableComponent: 'ElTable',
    dialogComponent: 'ElDialog',
    messageComponent: 'ElMessage',
    iconPackage: '@element-plus/icons-vue',
    styling: ['tailwindcss', 'css'],
  },

  'ant-design-vue': {
    id: 'ant-design-vue',
    name: 'Ant Design Vue',
    framework: 'vue3',
    npmPackage: 'ant-design-vue',
    cdnUrl: 'https://unpkg.com/ant-design-vue',
    description: 'Ant Design 的 Vue3 版本，企业级 UI 组件库，设计语言成熟',
    strengths: ['企业级设计语言', '组件最全面', '国际化支持好', 'ProComponents 生态'],
    componentMap: {
      button: 'AButton',
      input: 'AInput',
      select: 'ASelect',
      table: 'ATable',
      form: 'AForm',
      FormItem: 'AFormItem',
      dialog: 'AModal',
      drawer: 'ADrawer',
      pagination: 'APagination',
      tag: 'ATag',
      badge: 'ABadge',
      message: 'message',
      tabs: 'ATabs',
      TabPane: 'ATabPane',
      breadcrumb: 'ABreadcrumb',
      menu: 'AMenu',
      tree: 'ATree',
      datepicker: 'ADatePicker',
      upload: 'AUpload',
      switch: 'ASwitch',
      checkbox: 'ACheckbox',
      radio: 'ARadio',
      cascader: 'ACascader',
      transfer: 'ATransfer',
    },
    formComponent: 'AForm',
    tableComponent: 'ATable',
    dialogComponent: 'AModal',
    messageComponent: 'message',
    iconPackage: '@ant-design/icons-vue',
    styling: ['less', 'css'],
  },

  'naive-ui': {
    id: 'naive-ui',
    name: 'Naive UI',
    framework: 'vue3',
    npmPackage: 'naive-ui',
    description: 'Vue3 TypeScript 优先的 UI 库，主题定制能力强，Tree Shaking 友好',
    strengths: ['TypeScript 类型最好', '主题定制灵活', '无 CSS 依赖', 'Tree Shaking 友好'],
    componentMap: {
      button: 'NButton',
      input: 'NInput',
      select: 'NSelect',
      table: 'NDataTable',
      form: 'NForm',
      FormItem: 'NFormItem',
      dialog: 'NDialog',
      drawer: 'NDrawer',
      pagination: 'NPagination',
      tag: 'NTag',
      badge: 'NBadge',
      message: 'useMessage',
      tabs: 'NTabs',
      TabPane: 'NTabPane',
      breadcrumb: 'NBreadcrumb',
      menu: 'NMenu',
      tree: 'NTree',
      datepicker: 'NDatePicker',
      upload: 'NUpload',
      switch: 'NSwitch',
      checkbox: 'NCheckbox',
      radio: 'NRadio',
      cascader: 'NCascader',
    },
    formComponent: 'NForm',
    tableComponent: 'NDataTable',
    dialogComponent: 'NDialog',
    messageComponent: 'useMessage',
    styling: ['css', 'sass'],
  },

  'vuetify': {
    id: 'vuetify',
    name: 'Vuetify 3',
    framework: 'vue3',
    npmPackage: 'vuetify',
    description: 'Material Design 风格的 Vue3 UI 库，组件覆盖最全面',
    strengths: ['Material Design 风格', '组件最全面', '内置栅格系统', '国际化内置'],
    componentMap: {
      button: 'VBtn',
      input: 'VTextField',
      select: 'VSelect',
      table: 'VDataTable',
      form: 'VForm',
      dialog: 'VDialog',
      drawer: 'VNavigationDrawer',
      pagination: 'VPagination',
      tag: 'VChip',
      badge: 'VBadge',
      tabs: 'VTabs',
      TabPane: 'VTab',
      menu: 'VMenu',
      datepicker: 'VDatePicker',
    },
    formComponent: 'VForm',
    tableComponent: 'VDataTable',
    dialogComponent: 'VDialog',
    messageComponent: 'useSnackbar',
    iconPackage: '@mdi/font',
    styling: ['sass', 'css'],
  },

  'arco-design-vue': {
    id: 'arco-design-vue',
    name: 'Arco Design Vue',
    framework: 'vue3',
    npmPackage: '@arco-design/web-vue',
    description: '字节跳动出品的 Vue3 UI 库，设计现代，配置化表格强大',
    strengths: ['字节跳动出品', '表格配置化能力强', '设计语言现代', '暗色主题原生支持'],
    componentMap: {
      button: 'AButton',
      input: 'AInput',
      select: 'ASelect',
      table: 'ATable',
      form: 'AForm',
      FormItem: 'AFormItem',
      dialog: 'AModal',
      drawer: 'ADrawer',
      pagination: 'APagination',
      tag: 'ATag',
      badge: 'ABadge',
      message: 'Message',
      tabs: 'ATabs',
      TabPane: 'ATabPane',
      breadcrumb: 'ABreadcrumb',
      menu: 'AMenu',
      tree: 'ATree',
      datepicker: 'ADatePicker',
      upload: 'AUpload',
      switch: 'ASwitch',
      checkbox: 'ACheckbox',
      radio: 'ARadio',
      cascader: 'ACascader',
    },
    formComponent: 'AForm',
    tableComponent: 'ATable',
    dialogComponent: 'AModal',
    messageComponent: 'Message',
    iconPackage: '@arco-design/web-vue/es/icon',
    styling: ['less', 'css'],
  },

  'antd': {
    id: 'antd',
    name: 'Ant Design',
    framework: 'react',
    npmPackage: 'antd',
    description: '最流行的 React 企业级 UI 库，蚂蚁金服出品',
    strengths: ['最流行的 React UI 库', '企业级组件最全', 'ProComponents 生态', '设计资源丰富'],
    componentMap: {
      button: 'Button',
      input: 'Input',
      select: 'Select',
      table: 'Table',
      form: 'Form',
      FormItem: 'Form.Item',
      dialog: 'Modal',
      drawer: 'Drawer',
      pagination: 'Pagination',
      tag: 'Tag',
      badge: 'Badge',
      message: 'message',
      tabs: 'Tabs',
      TabPane: 'Tabs.TabPane',
      breadcrumb: 'Breadcrumb',
      menu: 'Menu',
      tree: 'Tree',
      datepicker: 'DatePicker',
      upload: 'Upload',
      switch: 'Switch',
      checkbox: 'Checkbox',
      radio: 'Radio',
      cascader: 'Cascader',
      transfer: 'Transfer',
    },
    formComponent: 'Form',
    tableComponent: 'Table',
    dialogComponent: 'Modal',
    messageComponent: 'message',
    iconPackage: '@ant-design/icons',
    styling: ['less', 'css'],
  },

  'arco-design-react': {
    id: 'arco-design-react',
    name: 'Arco Design',
    framework: 'react',
    npmPackage: '@arco-design/web-react',
    description: '字节跳动出品的 React UI 库，配置化表格和表单能力强',
    strengths: ['字节跳动出品', '配置化表格强大', '设计语言现代', '暗色主题原生'],
    componentMap: {
      button: 'Button',
      input: 'Input',
      select: 'Select',
      table: 'Table',
      form: 'Form',
      FormItem: 'Form.Item',
      dialog: 'Modal',
      drawer: 'Drawer',
      pagination: 'Pagination',
      tag: 'Tag',
      badge: 'Badge',
      message: 'Message',
      tabs: 'Tabs',
      TabPane: 'Tabs.TabPane',
      breadcrumb: 'Breadcrumb',
      menu: 'Menu',
      tree: 'Tree',
      datepicker: 'DatePicker',
      upload: 'Upload',
      switch: 'Switch',
      checkbox: 'Checkbox',
      radio: 'Radio',
    },
    formComponent: 'Form',
    tableComponent: 'Table',
    dialogComponent: 'Modal',
    messageComponent: 'Message',
    iconPackage: '@arco-design/web-react/icon',
    styling: ['less', 'css'],
  },

  'heroui': {
    id: 'heroui',
    name: 'HeroUI',
    framework: 'react',
    npmPackage: '@heroui/react',
    description: '现代化 React UI 库 (前身 NextUI)，基于 Tailwind CSS，动效出色',
    strengths: ['Tailwind CSS 原生', '动效最流畅', '暗色主题优秀', '现代设计语言'],
    componentMap: {
      button: 'Button',
      input: 'Input',
      select: 'Select',
      table: 'Table',
      form: '(自定义)',
      dialog: 'Modal',
      drawer: 'Drawer',
      pagination: 'Pagination',
      tag: 'Chip',
      badge: 'Badge',
      tabs: 'Tabs',
      TabPane: 'Tab',
      datepicker: 'DatePicker',
      switch: 'Switch',
      checkbox: 'Checkbox',
      radio: 'Radio',
    },
    formComponent: '(自定义表单)',
    tableComponent: 'Table',
    dialogComponent: 'Modal',
    messageComponent: '(Toast)',
    styling: ['tailwindcss'],
  },
};

/**
 * Get UI libraries compatible with a given framework.
 */
export function getCompatibleLibraries(framework: string): UiLibraryMeta[] {
  return Object.values(UI_CATALOG).filter(lib => {
    if (framework === 'vue3') return lib.framework === 'vue3' || lib.framework === 'both';
    if (framework === 'react') return lib.framework === 'react' || lib.framework === 'both';
    return true;
  });
}

/**
 * Get a specific UI library by ID.
 */
export function getUiLibrary(id: string): UiLibraryMeta | undefined {
  return UI_CATALOG[id];
}

/**
 * Get a short summary string for a library (used in prompts).
 */
export function getLibrarySummary(lib: UiLibraryMeta): string {
  return `- ${lib.name} (${lib.id}): ${lib.description} | 优势: ${lib.strengths.slice(0, 2).join(', ')}`;
}
