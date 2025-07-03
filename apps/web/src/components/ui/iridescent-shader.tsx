'use client'

import { useEffect, useRef, useState } from 'react'

interface IridescenceShaderProps {
  className?: string
  color?: [number, number, number]
  speed?: number
  amplitude?: number
  mouseReact?: boolean
}

export function IridescenceShader({
  className = '',
  color = [0.8, 0.4, 1],
  speed = 0.6,
  amplitude = 0.12,
  mouseReact = true
}: IridescenceShaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const [isWebGLSupported, setIsWebGLSupported] = useState(true)

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const container = containerRef.current
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')

    if (!gl) {
      setIsWebGLSupported(false)
      return
    }

    // Vertex shader source
    const vertexShaderSource = `
      attribute vec2 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    // Fragment shader source
    const fragmentShaderSource = `
      precision highp float;
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uResolution;
      uniform vec2 uMouse;
      uniform float uAmplitude;
      uniform float uSpeed;
      varying vec2 vUv;
      
      void main() {
        float mr = min(uResolution.x, uResolution.y);
        vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;
        uv += (uMouse - vec2(0.5)) * uAmplitude;
        float d = -uTime * 0.5 * uSpeed;
        float a = 0.0;
        for (float i = 0.0; i < 8.0; ++i) {
          a += cos(i - d - a * uv.x);
          d += sin(uv.y * i + a);
        }
        d += uTime * 0.5 * uSpeed;
        vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
        col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
        gl_FragColor = vec4(col, 1.0);
      }
    `

    // Create shader function
    function createShader(gl: WebGLRenderingContext, type: number, source: string) {
      const shader = gl.createShader(type)
      if (!shader) return null
      
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }
      
      return shader
    }

    // Create program function
    function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
      const program = gl.createProgram()
      if (!program) return null
      
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking program:', gl.getProgramInfoLog(program))
        gl.deleteProgram(program)
        return null
      }
      
      return program
    }

    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
    
    if (!vertexShader || !fragmentShader) {
      setIsWebGLSupported(false)
      return
    }

    // Create program
    const program = createProgram(gl, vertexShader, fragmentShader)
    if (!program) {
      setIsWebGLSupported(false)
      return
    }

    // Set up geometry (full screen triangle)
    const positions = new Float32Array([
      -1, -1,
      3, -1,
      -1, 3
    ])

    const uvs = new Float32Array([
      0, 0,
      2, 0,
      0, 2
    ])

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const uvBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW)

    // Get attribute and uniform locations
    const positionLocation = gl.getAttribLocation(program, 'position')
    const uvLocation = gl.getAttribLocation(program, 'uv')
    const timeLocation = gl.getUniformLocation(program, 'uTime')
    const colorLocation = gl.getUniformLocation(program, 'uColor')
    const resolutionLocation = gl.getUniformLocation(program, 'uResolution')
    const mouseLocation = gl.getUniformLocation(program, 'uMouse')
    const amplitudeLocation = gl.getUniformLocation(program, 'uAmplitude')
    const speedLocation = gl.getUniformLocation(program, 'uSpeed')

    // Mouse position state
    let mousePos = { x: 0.5, y: 0.5 }

    // Mouse move handler
    function handleMouseMove(e: MouseEvent) {
      if (!mouseReact) return
      
      const rect = container.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = 1.0 - (e.clientY - rect.top) / rect.height
      mousePos = { x, y }
    }

    // Resize handler
    function handleResize() {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    // Animation loop
    function animate(time: number) {
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.useProgram(program)

      // Set up attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
      gl.enableVertexAttribArray(uvLocation)
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0)

      // Set uniforms
      gl.uniform1f(timeLocation, time * 0.001)
      gl.uniform3f(colorLocation, color[0], color[1], color[2])
      gl.uniform3f(resolutionLocation, canvas.width, canvas.height, canvas.width / canvas.height)
      gl.uniform2f(mouseLocation, mousePos.x, mousePos.y)
      gl.uniform1f(amplitudeLocation, amplitude)
      gl.uniform1f(speedLocation, speed)

      // Draw
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      animationRef.current = requestAnimationFrame(animate)
    }

    // Set up event listeners
    container.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('resize', handleResize)

    // Initial setup
    handleResize()
    animate(0)

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      container.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      gl.deleteBuffer(positionBuffer)
      gl.deleteBuffer(uvBuffer)
    }
  }, [color, speed, amplitude, mouseReact])

  if (!isWebGLSupported) {
    // Fallback gradient for browsers without WebGL support
    return (
      <div 
        className={`bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${className}`}
        ref={containerRef}
      />
    )
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}