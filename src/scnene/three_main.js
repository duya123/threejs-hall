import * as THREE from 'three' // 引入 Three.js 库

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js' // 引入 GLTF 加载器

import { Octree } from 'three/addons/math/Octree.js' // 引入 Octree，用于碰撞检测

import { Capsule } from 'three/addons/math/Capsule.js' // 引入胶囊体碰撞模型

// 创建场景
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x88ccee) // 设置背景颜色
//scene.fog = new THREE.Fog(0x88ccee, 0, 50) // 设置雾化效果

// 创建摄像机
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.rotation.order = 'YXZ' // 设置摄像机的旋转顺序
// 定义相机的两个预设视角位置
const PerspectiveVectors = {
  first: new THREE.Vector3(0, 2.7, 0.7), // 第一视角：稍高于地面，稍靠前
  third: new THREE.Vector3(0, 2.7, -3) // 第三视角：稍高于地面，稍远离
}

// 设置相机初始位置为第三视角
camera.position.copy(PerspectiveVectors.third)
// 设置相机朝向目标点 (0, 1, 0)
camera.lookAt(0, 1.5, 0)

// 添加环境光
const ambientLight = new THREE.AmbientLight('#aa813f', 1.5)  // 灰色的环境光，强度为1
scene.add(ambientLight)
// 添加方向光
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5)
directionalLight.position.set(-5, 25, -1) // 设置光源位置
directionalLight.castShadow = true // 启用阴影
// 设置阴影的相关参数
directionalLight.shadow.camera.near = 0.01
directionalLight.shadow.camera.far = 500
directionalLight.shadow.camera.right = 30
directionalLight.shadow.camera.left = -30
directionalLight.shadow.camera.top = 30
directionalLight.shadow.camera.bottom = -30
directionalLight.shadow.mapSize.width = 1024
directionalLight.shadow.mapSize.height = 1024
directionalLight.shadow.radius = 4
directionalLight.shadow.bias = -0.00006
scene.add(directionalLight)

// 获取 HTML 容器元素
const container = document.getElementById('container')

// 创建渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio) // 设置像素比
renderer.setSize(window.innerWidth, window.innerHeight) // 设置渲染器大小
renderer.setAnimationLoop(animate) // 设置动画循环
renderer.shadowMap.enabled = true // 启用阴影
renderer.shadowMap.type = THREE.VSMShadowMap // 设置阴影映射类型
renderer.toneMapping = THREE.ACESFilmicToneMapping // 设置色调映射
renderer.outputColorSpace = THREE.SRGBColorSpace // 设置输出颜色空间为 sRGB
container.appendChild(renderer.domElement) // 将渲染器的 DOM 元素添加到容器中

// 加载模型
let playerModel = null // 存储人物模型，以便别处调用
let animationmixer = null // 人物模型动画
let mimiModel = null
let mimimixer = null // 猫咪模型动画
let isPlayerModelLoaded = false // 添加标记
let allActions = {}
let mimiActions = {}
let currentAction = null
let model = null
const gltfLoader = new GLTFLoader()
// 加载人物模型
gltfLoader.load('./models/mishi.glb', (gltf) => {
  model = gltf.scene
  scene.add(model)
  worldOctree.fromGraphNode(model) // 将模型添加到 Octree 用于碰撞检测
  // 修改材质，启用阴影
  model.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
      if (child.material.map) {
        child.material.map.anisotropy = 4
      }
    }
  })
  // 加载人物模型
  gltfLoader.load('./models/lufei.glb', (childgltf) => {
    playerModel = childgltf.scene
    scene.add(playerModel)
    playerModel.scale.set(0.4, 0.4, 0.4)
    playerModel.add(camera) // 相机与人物绑定
    isPlayerModelLoaded = true // 标记加载完成

    // 启用阴影
    playerModel.traverse(function (object) {
      if (object.isMesh) object.castShadow = true
    })

    // 关键帧动画
    const animations = childgltf.animations
    animationmixer = new THREE.AnimationMixer(playerModel)
    allActions = {}
    for (let i = 0; i < animations.length; i++) {
      // agree,headShake,idle,run,sad_pose,sneak_pose,walk
      const clip = animations[i]//休息、步行、跑步等动画的clip数据
      const action = animationmixer.clipAction(clip)//clip生成action
      action.name = clip.name//action命名name
      // 批量设置所有动画动作的权重
      if (action.name === 'standing') {
        action.weight = 1.0//默认播放Idle对应的休息动画
      } else {
        action.weight = 0.0
      }
      action.play()
      // action动画动作名字作为actionObj的属性
      allActions[action.name] = action
    }
    currentAction = allActions['standing']
  })

  // 导入猫咪模型
  gltfLoader.load('./models/maomi.glb', (mimigltf) => {
    mimiModel = mimigltf.scene
    mimiModel.position.set(0, 0, 0)
    scene.add(mimiModel)

    const animations = mimigltf.animations
    // 创建猫咪动画动作集
    mimiActions = {}
    if (animations.length > 0) {
      mimimixer = new THREE.AnimationMixer(mimiModel)
      for (let i = 0; i < animations.length; i++) {
        const clip = animations[i] // 休息、步行、跑步等动画的clip数据
        const action = mimimixer.clipAction(clip) // 绑定到正确的混合器
        action.name = clip.name // 动作命名
        // action.play() // 预加载动画
        mimiActions[action.name] = action // 存储到猫咪的动作集
      }
    }
  })

  // 同步完成后移除遮罩层
  const loadingMask = document.getElementById('loading-mask')
  if (loadingMask) {
    setTimeout(() => {
      loadingMask.style.opacity = '0'  // 触发透明度过渡
    }, 1000) // 设置延迟时间，以便用户看到过渡效果

    // 在透明度过渡完成后隐藏遮罩
    setTimeout(() => {
      loadingMask.style.display = 'none'
    }, 2000)  // 确保透明度过渡完成后再隐藏
  }
})


// --- 以下部分就是场景交互功能---

// 重力常量
const GRAVITY = 30
// 创建 Octree 用于碰撞检测
const worldOctree = new Octree()
// 创建胶囊体碰撞器(模拟人体)
const playerCollider = new Capsule(new THREE.Vector3(1.8, 0.35, 4.8), new THREE.Vector3(1.8, 1.35, 4.8), 0.35)
// 修正角色位置使其触地
const playerFixVector = new THREE.Vector3(0, 0.35, 0)
// 运动速度
const playerVelocity = new THREE.Vector3()
// 运动方向
const playerDirection = new THREE.Vector3()
// 假设人物不在地面
let playerOnFloor = false
// 按下前进按键的持续时间
let ForwardHoldTimeClock = new THREE.Clock()
ForwardHoldTimeClock.autoStart = false
// 按键事件状态
const keyStates = {
  W: false,
  A: false,
  S: false,
  D: false,
  Space: false,
  leftMouseBtn: false
}
// 角色运动状态
const playerActionState = {
  forward: 0,
  turn: 0
}

// 人物模型与周边物体的碰撞检测
function playerCollisions() {
  const result = worldOctree.capsuleIntersect(playerCollider) // 检查玩家碰撞
  playerOnFloor = false

  if (result) {
    playerOnFloor = result.normal.y > 0 // 如果碰撞法线的y值大于0，说明玩家在地面上

    if (!playerOnFloor) { // 如果玩家不在地面上
      playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity)) // 根据碰撞法线反向调整玩家的速度
    }

    if (result.depth >= 1e-10) { // 将玩家的碰撞体根据碰撞的深度进行平移
      playerCollider.translate(result.normal.multiplyScalar(result.depth)) // 调整位置避免穿透

    }
  }
}

// 更新人物模型位置信息
function updatePlayer(deltaTime) {


  if (!isPlayerModelLoaded) return // 如果模型未加载，直接返回

  let speedRatio = 1.2  // 设置初始速度比率
  let damping = Math.exp(-8 * deltaTime) - 1 // 计算阻尼

  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * deltaTime // 应用重力
    //playerVelocity.y -= GRAVITY * deltaTime
    damping *= 0.1 // 在空中时减少阻尼
    speedRatio = 0.5 // 空中时的速度比率加倍
  }

  playerVelocity.addScaledVector(playerVelocity, damping) // 应用阻尼

  // 如果玩家正在前进
  if (playerActionState.forward > 0) {
    if (playerActionState.turn != 0) {
      playerModel.rotation.y -= playerActionState.turn * deltaTime * 2
    }
    // 前进状态持续3s以上转为跑步状态
    if (ForwardHoldTimeClock.getElapsedTime() > 3) {
      if (playerOnFloor) speedRatio = 5
      changeAction('run')
    } else {
      changeAction('walk')
    }
  }
  // 如果玩家向后移动
  if (playerActionState.forward < 0) {
    changeAction('walk')  // 切换到行走动作
  }
  // 如果玩家没有前进但正在转向
  if (playerActionState.forward == 0 && playerActionState.turn != 0) {
    // playerModel.rotation.y -= playerActionState.turn * deltaTime * 2 // 原地转向
    if (playerActionState.turn > 0) {
      // 右转
      changeAction('strafeRight') // 切换到右转动作
    } else if (playerActionState.turn < 0) {
      // 左转
      changeAction('strafeLeft') // 切换到左转动作
    }
  }
  // 如果玩家没有前进也没有转向
  if (playerActionState.forward == 0 && playerActionState.turn == 0) {
    changeAction('standing')  // 切换到休息状态
  }

  // 计算移动的位移：速度 * 时间 = 移动的距离（向量）
  const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime * speedRatio)
  deltaPosition.y /= speedRatio  // 高度分量不受速度系数的影响
  // 更新角色位置
  playerCollider.translate(deltaPosition)

  playerCollisions() // 检查碰撞
  updateCameraCollision() // 相机碰撞


  // 更新玩家的位置，使用修正向量
  playerModel.position.copy(new THREE.Vector3().subVectors(playerCollider.start, playerFixVector))
}

// 前进方向上的向量
function getForwardVector() {
  // 获取玩家的世界方向并存储到playerDirection
  playerModel.getWorldDirection(playerDirection)

  // 将y轴的分量设为0，确保方向仅在水平面上
  playerDirection.y = 0

  // 归一化向量，使得其长度为1
  playerDirection.normalize()

  // 返回计算出的前进方向向量
  return playerDirection
}

// 横移方向上的向量
function getSideVector() {
  // 获取玩家的世界方向并存储到playerDirection
  playerModel.getWorldDirection(playerDirection)

  // 将y轴的分量设为0，确保方向仅在水平面上
  playerDirection.y = 0

  // 归一化向量，使得其长度为1
  playerDirection.normalize()

  // 计算玩家右侧的横移方向，通过交叉产品计算
  playerDirection.cross(playerModel.up)

  // 返回计算出的横移方向向量
  return playerDirection
}

// 角色行动控制
let speedDelta
function controls(deltaTime) {
  speedDelta = deltaTime * (playerOnFloor ? 10 : 5) // 调节移动速度

  if (keyStates['W']) {
    playerVelocity.add(getForwardVector().multiplyScalar(speedDelta)) // 前进
  }

  if (keyStates['S']) {
    playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta)) // 后退
  }

  if (keyStates['A']) {
    playerVelocity.add(getSideVector().multiplyScalar(-speedDelta)) // 左移
  }

  if (keyStates['D']) {
    playerVelocity.add(getSideVector().multiplyScalar(speedDelta)) // 右移
  }

  if (playerOnFloor) {
    if (keyStates['Space']) {
      playerVelocity.y = 5// 跳跃 
      changeAction('jumpDown')
    }
  }
}

// 超出边界回到初始位置
function teleportPlayerIfOob() {
  if (camera.position.y <= -25) { // 如果玩家超出边界
    playerCollider.start.set(0, 0.35, 0) // 重置玩家位置
    playerCollider.end.set(0, 1, 0)
    playerCollider.radius = 0.35
    // 将玩家位置调整为起始位置减去一个修正向量
    playerModel.position.copy(new THREE.Vector3().subVectors(playerCollider.start, playerFixVector))
    camera.rotation.set(0, 0, 0)
  }
}

// 切换动画
function changeAction(actionName) {
  // 如果指定的动作存在并且当前动作不是目标动作
  if (allActions[actionName] && currentAction.name != actionName) {
    // 如果当前动作是“idle”（休息状态）
    if (currentAction.name === 'standing') {
      // 执行交叉淡入淡出效果，切换到指定动作
      executeCrossFade(actionName)
    } else {
      // 执行交叉淡入淡出效果，切换到指定动作
      executeCrossFade(actionName)
    }
  }
}

// 控制动画播放
function executeCrossFade(actionName) {
  const action = allActions[actionName]
  action.enabled = true
  action.setEffectiveTimeScale(1)
  action.setEffectiveWeight(1)
  action.time = 0
  currentAction.crossFadeTo(action, 0.35, true)
  currentAction = action
}

let keyW = false
let isThirdPerson = false // 默认是第三人称

// 当某个键盘按下设置对应属性设置为true
document.addEventListener('keydown', (event) => {
  if (event.code === 'KeyW') {
    keyStates.W = true; playerActionState.forward = 1
    if (!keyW) { // keydown事件在按下按键不松时会持续激活，因此需进行状态控制，避免计时器重复计时
      ForwardHoldTimeClock.start()
      keyW = true
    }

  }
  if (event.code === 'KeyA') { keyStates.A = true; playerActionState.turn = -1 }
  if (event.code === 'KeyS') { keyStates.S = true; playerActionState.forward = -1 }
  if (event.code === 'KeyD') { keyStates.D = true; playerActionState.turn = 1 }
  if (event.code === 'KeyR') { keyStates.R = true }
  if (event.code === 'Space') { keyStates.Space = true }
  if (event.code === 'KeyV') {
    isThirdPerson = !isThirdPerson // 切换视角模式
    if (isThirdPerson) {
      camera.position.copy(PerspectiveVectors.first)
    } else {
      camera.position.copy(PerspectiveVectors.third)
    }
  }
})

// 当某个键盘抬起设置对应属性设置为false
document.addEventListener('keyup', (event) => {
  if (event.code === 'KeyW') {
    keyW = false
    keyStates.W = false
    playerActionState.forward = 0
    ForwardHoldTimeClock.stop()
    ForwardHoldTimeClock.elapsedTime = 0
  }
  if (event.code === 'KeyA') { keyStates.A = false; playerActionState.turn = 0 }
  if (event.code === 'KeyS') { keyStates.S = false; playerActionState.forward = 0 }
  if (event.code === 'KeyD') { keyStates.D = false; playerActionState.turn = 0 }
  if (event.code === 'KeyR') { keyStates.R = false }
  if (event.code === 'Space') keyStates.Space = false

  // 保持按键打断前的状态
  playerActionState.forward = keyStates.W == true ? 1 : playerActionState.forward
  playerActionState.turn = keyStates.A == true ? -1 : playerActionState.turn
  playerActionState.forward = keyStates.S == true ? -1 : playerActionState.forward
  playerActionState.turn = keyStates.D == true ? 1 : playerActionState.turn

})

// 鼠标按键按下
document.addEventListener('mousedown', (event) => {
  // document.body.requestPointerLock()
  if (event.button == 0) {
    // 鼠标左键被点击
    keyStates.leftMouseBtn = true

  }
})

// 鼠标按键抬起
document.addEventListener('mouseup', (event) => {
  if (event.button == 0) {
    // 鼠标左键抬起
    keyStates.leftMouseBtn = false
  }
})

// 相机视角跟随鼠标旋转
let cameraMoveSensitivity = 0.001 // 阻尼因子，值越小，旋转越平滑
document.body.addEventListener('mousemove', (event) => {
  // 鼠标左键按下时，拖动鼠标以移动视角
  if (keyStates.leftMouseBtn) {
    // 如果相机的灵敏度小于等于0，设置为一个最小值
    if (cameraMoveSensitivity <= 0) cameraMoveSensitivity = 0.001

    // 如果相机的灵敏度大于1，设置为1
    if (cameraMoveSensitivity > 1) cameraMoveSensitivity = 1

    // 计算鼠标移动的增量，使用灵敏度调整移动量
    let deltaX = event.movementX / (cameraMoveSensitivity * 500)
    let deltaY = event.movementY / (cameraMoveSensitivity * 500)

    // 设置转动阻尼系数，使得旋转增量随着时间逐渐减小
    deltaX *= cameraMoveSensitivity    // 应用阻尼效果到X轴旋转增量
    deltaY *= cameraMoveSensitivity    // 应用阻尼效果到Y轴旋转增量

    // // 更新玩家和相机的旋转，减去旋转增量来旋转它们
    playerModel.rotation.y -= deltaX  // 更新玩家沿Y轴的旋转
    camera.rotation.x -= deltaY  // 更新相机沿X轴的旋转

    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x))
  }
})

// 创建射线检测器
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const audio = new Audio('../../public/models/WeChat.mp3') // 获取音频

// 添加鼠标左键点击事件监听
document.addEventListener('click', (event) => {
  // 转换鼠标位置为标准化设备坐标
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  // 更新射线方向
  raycaster.setFromCamera(mouse, camera)

  // 检测交互对象
  const intersects = raycaster.intersectObjects(scene.children, true)

  for (let i = 0; i < intersects.length; i++) {
    const object = intersects[i].object
    // 检查是否点击到猫咪模型
    if (object.name === '0') {
      // 播放动画
      const action = mimiActions['Take 001'] // 替换为实际动画名称
      if (action) {
        action.reset().play() // 重置并播放动画
        audio.play()
        audio.addEventListener('ended', () => {
          action.reset().stop()
        })
      } else {
        console.warn('Animation action not found.')
      }
      break // 找到后退出循环
    }

  }
})

// 相机碰撞检测
function updateCameraCollision() {
  // 仅三人称漫游开启检测，否则直接return
  if (isThirdPerson) return
  // 相机碰撞胶囊体
  const cameraCollider = new Capsule(
    new THREE.Vector3(0, 0.35, -3), // 相对于玩家模型的初始位置
    new THREE.Vector3(0, 1.35, -3),
    1
  )
  const smoothFactor = 0.06 // 控制相机靠近目标位置的速度(速度太慢会导致相机穿墙)
  // 定义相机胶囊体相对于玩家的位置（相机距离玩家1.7单位的高度，向后偏移1.5单位）
  const cameraRelativePosition = new THREE.Vector3(0, 2.7, -3)
  // 将相机胶囊体的局部位置转换为世界坐标系中的位置
  const worldPosition = playerModel.localToWorld(cameraRelativePosition)
  // 将转换后的世界坐标设置为胶囊体的起始位置（cameraCollider.start）
  cameraCollider.start.copy(worldPosition)
  // 将起始位置向上偏移0.1单位，设置为胶囊体的结束位置（cameraCollider.end），防止穿透地面
  cameraCollider.end.copy(worldPosition).add(new THREE.Vector3(0, 0.1, 0))
  // 碰撞检测
  const result = worldOctree.capsuleIntersect(cameraCollider)
  if (result) {
    // 根据碰撞的深度进行平移 调整位置避免穿透
    cameraCollider.translate(result.normal.multiplyScalar(result.depth))
    const targetCameraPosition = new THREE.Vector3(0, 2.7, -0.8)
    camera.position.lerp(targetCameraPosition, smoothFactor)
  } else {
    const targetCameraPosition2 = PerspectiveVectors.third
    camera.position.lerp(targetCameraPosition2, smoothFactor)
  }
}

// 添加窗口大小变化事件监听
window.addEventListener('resize', onWindowResize)
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight // 更新摄像机宽高比
  camera.updateProjectionMatrix() // 更新投影矩阵
  renderer.setSize(window.innerWidth, window.innerHeight) // 更新渲染器大小
}

// 创建时钟，用于计算时间增量
const clock = new THREE.Clock()
let previousTime = 0 // 记录上一帧的时间
const STEPS_PER_FRAME = 5 // 每帧的更新步数，用于控制时间步进的精度

function animate() {
  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME // 计算时间增量
  const elapsedTime = clock.getElapsedTime() // 获取累计时间
  const mixerUpdateDelta = elapsedTime - previousTime // 计算动画混合器的时间增量
  previousTime = elapsedTime // 更新上一帧时间

  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    controls(deltaTime) // 处理控制
    updatePlayer(deltaTime) // 更新玩家
  }
  teleportPlayerIfOob() // 检查是否越界

  if (animationmixer instanceof THREE.AnimationMixer) {
    animationmixer.update(mixerUpdateDelta) // 更新动画混合器
  }
  if (mimimixer instanceof THREE.AnimationMixer) {
    mimimixer.update(mixerUpdateDelta) // 更新动画混合器
  }

  renderer.render(scene, camera) // 渲染场景
}