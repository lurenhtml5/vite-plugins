### vite插件机制

#### 命名约定

如果插件不使用 Vite 特有的钩子，可以实现为 [兼容的 Rollup 插件](https://cn.vitejs.dev/guide/api-plugin.html#Rollup-插件兼容性)，推荐使用 [Rollup 插件名称约定](https://rollupjs.org/guide/en/#conventions)。

- Rollup 插件应该有一个带 `rollup-plugin-` 前缀、语义清晰的名称。
- 在 package.json 中包含 `rollup-plugin` 和 `vite-plugin` 关键字。

这样，插件也可以用于纯 Rollup 或基于 WMR 的项目。

对于 Vite 专属的插件：

- Vite 插件应该有一个带 `vite-plugin-` 前缀、语义清晰的名称。
- 在 package.json 中包含 `vite-plugin` 关键字。
- 在插件文档增加一部分关于为什么本插件是一个 Vite 专属插件的详细说明（如，本插件使用了 Vite 特有的插件钩子）。

如果你的插件只适用于特定的框架，它的名字应该遵循以下前缀格式：

- `vite-plugin-vue-` 前缀作为 Vue 插件
- `vite-plugin-react-` 前缀作为 React 插件
- `vite-plugin-svelte-` 前缀作为 Svelte 插件

#### 插件配置

用户会将插件添加到项目的 `devDependencies` 中并使用数组形式的 `plugins` 选项配置它们。

```javascript
import vitePlugin from 'vite-plugin-feature'
import rollupPlugin from 'rollup-plugin-feature'
export default {
  plugins: [vitePlugin(), rollupPlugin()]
}
```

假值的插件将被忽略，可以用来轻松地启用或停用插件。

`plugins` 也可以接受将多个插件作为单个元素的预设。这对于使用多个插件实现的复杂特性（如框架集成）很有用。该数组将在内部被扁平化（flatten）。

```javascript
// 框架插件
import frameworkRefresh from 'vite-plugin-framework-refresh'
import frameworkDevtools from 'vite-plugin-framework-devtools'
export default function framework(config) {
  return [frameworkRefresh(config), frameworkDevTools(config)]
}
```

```javascript
// vite.config.js
import framework from 'vite-plugin-framework'
export default {
  plugins: [framework()]
}
```

#### 简单示例

###### 引入一个虚拟文件

```javascript
export default function myPlugin() {
  const virtualFileId = '@my-virtual-file'
  return {
    name: 'my-plugin', // 必须的，将会显示在 warning 和 error 中
    resolveId(id) {
      if (id === virtualFileId) {
        return virtualFileId
      }
    },
    load(id) {
      if (id === virtualFileId) {
        return `export const msg = "from virtual file"` // 替换文件内容
      }
    }
  }
}
```

这使得可以在 JavaScript 中引入这些文件：

```javascript
import { msg } from '@my-virtual-file'
console.log(msg) //  from virtual file
```

###### 转换自定义文件类型

```javascript
const fileRegex = /\.(my-file-ext)$/
export default function myPlugin() {
  return {
    name: 'transform-file',
    transform(src, id) {
      if (fileRegex.test(id)) {
        return {
          code: compileFileToJS(src), // 文件类型转换
          map: null // 如果可行将提供 source map
        }
      }
    }
  }
}
```

#### 通用钩子

在开发中，Vite 开发服务器会创建一个插件容器来调用 [Rollup 构建钩子](https://rollupjs.org/guide/en/#build-hooks)，与 Rollup 如出一辙。

##### 以下钩子在服务器启动时被调用

- `options`
- `buildStart`

###### options

- Type: ( inputOptions ) => options


rollup打包的第一个钩子，在rollup完全配置完成之前，用来替换或者操作rollup的配置，返回null，表示不做任何操作，如果简单的只是为了读rollup的配置文件，那么可以在`buildStart`这个钩子里面去获取；同时，它是rollup所有钩子里唯一一个无法获取 [plugin context](https://rollupjs.org/guide/en/#plugin-context) 的钩子，这个钩子应该一般很少用到。

###### buildStart

- Type: `(options: InputOptions) => void`
- Previous Hook: [`options`](https://rollupjs.org/guide/en/#options)
- Next Hook: [`resolveId`](https://rollupjs.org/guide/en/#resolveid)

跟在options钩子后面，在rollup构建时候触发，主要用来获取rollup的配置

##### 以下钩子会在每个模块请求时调用

###### resolveId

- Type: `(importee, importer) => (id|Promise)`
- Previous Hook: [`buildStart`](https://rollupjs.org/guide/en/#buildstart)、[`moduleParsed`](https://rollupjs.org/guide/en/#moduleparsed)、[`resolveDynamicImport`](https://rollupjs.org/guide/en/#resolvedynamicimport).
- Next Hook: [`load`](https://rollupjs.org/guide/en/#load)

如果配置了[`buildStart`](https://rollupjs.org/guide/en/#buildstart)、[`moduleParsed`](https://rollupjs.org/guide/en/#moduleparsed)、[`resolveDynamicImport`](https://rollupjs.org/guide/en/#resolvedynamicimport)、那么resolveId钩子会跟在前面三个钩子后面依次触发；需要说明一下，[`moduleParsed`](https://rollupjs.org/guide/en/#moduleparsed)和[`resolveDynamicImport`](https://rollupjs.org/guide/en/#resolvedynamicimport)这两个钩子在rollup的serve(开发模式)下并不会用到。在某个插件触发[`this.emitFile`](https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string)或者[`this.resolve`](https://rollupjs.org/guide/en/#thisresolvesource-string-importer-string-options-skipself-boolean-custom-plugin-string-any--promiseid-string-external-boolean--absolute-modulesideeffects-boolean--no-treeshake-syntheticnamedexports-boolean--string-meta-plugin-string-any--null) 手动resolve一个id的时候，就会触发resolveId钩子；返回null，表示采用默认的解析方式；返回false，表示importee被作为外部模块，不会打包进bundle。

```javascript
async resolveId(importee,importer) {
  // importee表示的是chunk本身，importer表示引入importee的chunk
  // 例如我在App.tsx里面引入了上面虚拟文件的内容，则importee = @my-virtual-file，importer = App.tsx的绝对路径
  if (!importer) {
    // We need to skip this plugin to avoid an infinite loop
    const resolution = await this.resolve(importee, undefined, { skipSelf: true });
    // If it cannot be resolved, return `null` so that Rollup displays an error
    if (!resolution) return null;
    return `${resolution.id}?entry-proxy`;
  }
  return null;
},
load(id) {
  if (id.endsWith('?entry-proxy')) {
    // get resolution.id
    const importee = id.slice(0, -'?entry-proxy'.length);
    // Note that this will throw if there is no default export
    return `export {default} from '${importee}';`;
  }
  return null;
}
```

###### load

- Type: `(id: string) => string | null | {code: string, map?: string | SourceMap, ast? : ESTree.Program, moduleSideEffects?: boolean | "no-treeshake" | null, syntheticNamedExports?: boolean | string | null, meta?: {[plugin: string]: any} | null}`
- Previous Hook: [`resolveId`](https://rollupjs.org/guide/en/#resolveid) or [`resolveDynamicImport`](https://rollupjs.org/guide/en/#resolvedynamicimport)
- Next Hook: [`transform`](https://rollupjs.org/guide/en/#transform)

自定义一个loader，去返回自定义的文件内容；如果返回null，那么返回的就是系统解析这个chunk的默认内容，load可返回的内容类型太多，包括sourceMap, ast等，具体的参见[`load`](https://rollupjs.org/guide/en/#load)

###### transform

- Type: `(code: string, id: string) => string | null | {code?: string, map?: string | SourceMap, ast? : ESTree.Program, moduleSideEffects?: boolean | "no-treeshake" | null, syntheticNamedExports?: boolean | string | null, meta?: {[plugin: string]: any} | null}`
- Previous Hook: [`load`](https://rollupjs.org/guide/en/#load)
- NextHook: [`moduleParsed`](https://rollupjs.org/guide/en/#moduleparsed) once the file has been processed and parsed.

用来针对load之后的chunk做转换，避免额外的编译开销

##### 以下钩子在服务器关闭时被调用

- [`buildEnd`](https://rollupjs.org/guide/en/#buildend)
- [`closeBundle`](https://rollupjs.org/guide/en/#closebundle)

###### buildEnd

- Type: `(error?: Error) => void`
- Previous Hook: [`moduleParsed`](https://rollupjs.org/guide/en/#moduleparsed), [`resolveId`](https://rollupjs.org/guide/en/#resolveid) or [`resolveDynamicImport`](https://rollupjs.org/guide/en/#resolvedynamicimport).
- Next Hook: [`outputOptions`](https://rollupjs.org/guide/en/#outputoptions) in the output generation phase as this is the last hook of the build phase.

在bunding finished的时候、写文件之前触发，也可以返回Promise；如果在build过程中报错，也会触发这个钩子

#### vite独有的钩子

###### config

- Type: `(config: UserConfig, env: { mode: string, command: string }) => UserConfig | null | void`

在解析 Vite 配置前调用。钩子接收原始用户配置（命令行选项指定的会与配置文件合并）和一个描述配置环境的变量，包含正在使用的 `mode` 和 `command`。它可以返回一个将被深度合并到现有配置中的部分配置对象，或者直接改变配置（如果默认的合并不能达到预期的结果）。在config钩子内调用任何其他的

```javascript
// 返回部分配置（推荐）
const partialConfigPlugin = () => ({
  name: 'return-partial',
  config: () => ({
    alias: {
      foo: 'bar'
    }
  })
})
// 直接改变配置（应仅在合并不起作用时使用）
const mutateConfigPlugin = () => ({
  name: 'mutate-config',
  config(config, { command }) {
    if (command === 'build') {
      config.root = __dirname
    }
  }
})
```

###### configResolved

- Type: `(config: ResolvedConfig) => void | Promise<void>`

在解析 Vite 配置后调用。使用这个钩子读取和存储最终解析的配置。当插件需要根据运行的命令做一些不同的事情时，它也很有用。

```javascript
const exmaplePlugin = () => {
  let config
  return {
    name: 'read-config',
    configResolved(resolvedConfig) {
      // 存储最终解析的配置
      config = resolvedConfig
    },
    // 使用其他钩子存储的配置
    transform(code, id) {
      if (config.command === 'serve') {
        // serve: 用于启动开发服务器的插件
      } else {
        // build: 调用 Rollup 的插件
      }
    }
  }
}
```

###### configureServer

- Type: `(server: ViteDevServer) => (() => void) | void | Promise<(() => void) | void>`
- ViteDevServer接口：[ViteDevServer](https://cn.vitejs.dev/guide/api-javascript.html#vitedevserver)

是用于配置开发服务器的钩子。最常见的用例是在内部 [connect](https://github.com/senchalabs/connect) 应用程序中添加自定义中间件:

```javascript
const myPlugin = () => ({
  name: 'configure-server',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      // 自定义请求处理...
    })
  }
})
```

注入后置中间件

`configureServer` 钩子将在内部中间件被安装前调用，所以自定义的中间件将会默认会比内部中间件早运行。如果你想注入一个在内部中间件 **之后** 运行的中间件，你可以从 `configureServer` 返回一个函数，将会在内部中间件安装后被调用：

```javascript
const myPlugin = () => ({
  name: 'configure-server',
  configureServer(server) {
    // 返回一个在内部中间件安装后
    // 被调用的后置钩子
    return () => {
      server.middlewares.use((req, res, next) => {
        // 自定义请求处理...
      })
    }
  }
})
```

注意 `configureServer` 在运行生产版本时不会被调用，所以其他钩子需要注意防止它的缺失。

###### transformIndexHtml

- Type:  `IndexHtmlTransformHook | { enforce?: 'pre' | 'post' transform: IndexHtmlTransformHook }`

转换 `index.html` 的专用钩子。钩子接收当前的 HTML 字符串和转换上下文。上下文在开发期间暴露[`ViteDevServer`](https://cn.vitejs.dev/guide/api-javascript.html#ViteDevServer)实例，在构建期间暴露 Rollup 输出的包。

这个钩子可以是异步的，并且可以返回以下其中之一:

- 经过转换的 HTML 字符串
- 注入到现有 HTML 中的标签描述符对象数组（`{ tag, attrs, children }`）。每个标签也可以指定它应该被注入到哪里（默认是在 `<head>` 之前）
- 一个包含 `{ html, tags }` 的对象

```javascript
const htmlPlugin = () => {
  return {
    name: 'html-transform',
    transformIndexHtml(html) {
      return html.replace(
        /<title>(.*?)<\/title>/,
        `<title>Title replaced!</title>`
      )
    }
  }
}
```

###### handleHotUpdate

- Type: `(ctx: HmrContext) => Array<ModuleNode> | void | Promise<Array<ModuleNode> | void>`

```
interface HmrContext {
  file: string
  timestamp: number
  modules: Array<ModuleNode>
  read: () => string | Promise<string>
  server: ViteDevServer
}
```

- `modules` 是受更改文件影响的模块数组。它是一个数组，因为单个文件可能映射到多个服务模块（例如 Vue 单文件组件）。
- `read` 这是一个异步读函数，它返回文件的内容。之所以这样做，是因为在某些系统上，文件更改的回调函数可能会在编辑器完成文件更新之前过快地触发，并 `fs.readFile` 直接会返回空内容。传入的 `read` 函数规范了这种行为。

钩子可以选择:

- 过滤和缩小受影响的模块列表，使 HMR 更准确。
- 返回一个空数组，并通过向客户端发送自定义事件来执行完整的自定义 HMR 处理:

```javascript
handleHotUpdate({ server }) {
  server.ws.send({
    type: 'custom',
    event: 'special-update',
    data: {}
  })
  return []
}
```

客户端代码应该使用 [HMR API](https://cn.vitejs.dev/guide/api-hmr.html) 注册相应的处理器（这应该被相同插件的 `transform` 钩子注入）：

```javascript
if (import.meta.hot) {
  import.meta.hot.on('special-update', (data) => {
    // 执行自定义更新
  })
}
```

#### 钩子执行顺序总结

```javascript
export default function myExample () {
    // 返回的是插件对象
    return {
        name: 'hooks-order', 
        // 初始化hooks，只走一次
        options(opts) {
            console.log('options');
        },
        buildStart() {
            console.log('buildStart');
        },
        // vite特有钩子
        config(config) {
            console.log('config');
            return {}
        },
        configResolved(resolvedCofnig) {
            console.log('configResolved');
        },
        configureServer(server) {
            console.log('configureServer');
            // server.app.use((req, res, next) => {
            //   // custom handle request...
            // })
        },
        transformIndexHtml(html) {
            console.log('transformIndexHtml');
            return html
            // return html.replace(
            //   /<title>(.*?)<\/title>/,
            //   `<title>Title replaced!</title>`
            // )
        },
        // 通用钩子
        resolveId(source) {
            console.log(resolveId)
            if (source === 'virtual-module') {
                console.log('resolvedId');
                return source; 
            }
            return null; 
        },
        load(id) {
            console.log('load');
                
            if (id === 'virtual-module') {
                return 'export default "This is virtual!"';
            }
            return null;
        },
        transform(code, id) {
            console.log('transform');
            if (id === 'virtual-module') {
            }
            return code
        },
    };
  }

```

执行结果

```
config
configResolved
options
configureServer
buildStart
transformIndexHtml
load
load
transform
transform
```

钩子执行顺序

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e229d9ff7880440bafcc5f188486defc~tplv-k3u1fbpfcp-zoom-1.image)

#### 插件执行顺序

和webpack有点类似，也是通过enforce字段控制

- 别名处理Alias
- 用户插件设置`enforce: 'pre'`
- Vite核心插件
- 用户插件未设置`enforce`
- Vite构建插件
- 用户插件设置`enforce: 'post'`
- Vite构建后置插件(minify, manifest, reporting)

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bf65b1e604df4ff6903081128ee4e591~tplv-k3u1fbpfcp-zoom-1.image)

由于公司后续架构升级会用到vue3+vite，考虑到vite暂时可能还有些轮子不够健全，不排除后续工作需要自己写vite插件，所以在此稍做总结，不对的地方还望指正。

参考链接：

https://github.com/lurenhtml5/vite-plugins

https://cn.vitejs.dev/guide/api-plugin.html

https://rollupjs.org/guide/en/#plugin-development
