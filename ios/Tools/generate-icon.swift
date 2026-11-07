import AppKit
import Foundation

// Vector artwork rendered at build time, with no font or network dependency.
let destination = CommandLine.arguments[1]
let context = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8,
                        bytesPerRow: 4096, space: CGColorSpaceCreateDeviceRGB(),
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
NSColor(calibratedRed: 0.10, green: 0.13, blue: 0.20, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: 1024, height: 1024)).fill()
let banana = NSBezierPath()
banana.move(to: NSPoint(x: 205, y: 672))
banana.curve(to: NSPoint(x: 777, y: 690), controlPoint1: NSPoint(x: 315, y: 285), controlPoint2: NSPoint(x: 666, y: 310))
banana.line(to: NSPoint(x: 816, y: 711))
banana.curve(to: NSPoint(x: 585, y: 224), controlPoint1: NSPoint(x: 895, y: 454), controlPoint2: NSPoint(x: 775, y: 242))
banana.curve(to: NSPoint(x: 164, y: 660), controlPoint1: NSPoint(x: 340, y: 174), controlPoint2: NSPoint(x: 133, y: 384))
banana.close()
NSColor(calibratedRed: 1, green: 0.82, blue: 0.17, alpha: 1).setFill(); banana.fill()
let highlight = NSBezierPath(); highlight.move(to: NSPoint(x: 223, y: 573))
highlight.curve(to: NSPoint(x: 727, y: 401), controlPoint1: NSPoint(x: 301, y: 282), controlPoint2: NSPoint(x: 570, y: 262))
highlight.lineWidth = 26; highlight.lineCapStyle = .round
NSColor(calibratedRed: 1, green: 0.94, blue: 0.55, alpha: 1).setStroke(); highlight.stroke()
NSColor(calibratedRed: 0.54, green: 0.68, blue: 0.25, alpha: 1).setFill()
NSBezierPath(roundedRect: NSRect(x: 160, y: 640, width: 52, height: 100), xRadius: 18, yRadius: 18).fill()
NSBezierPath(roundedRect: NSRect(x: 774, y: 679, width: 52, height: 80), xRadius: 18, yRadius: 18).fill()
NSGraphicsContext.restoreGraphicsState()
let bitmap = NSBitmapImageRep(cgImage: context.makeImage()!)
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: destination))
