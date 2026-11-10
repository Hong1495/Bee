import AppKit
for path in CommandLine.arguments.dropFirst() {
 let image = NSImage(contentsOfFile:path)!
 let rep = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:1024,pixelsHigh:1024,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:4096,bitsPerPixel:32)!
 NSGraphicsContext.saveGraphicsState()
 NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep:rep)
 image.draw(in:NSRect(x:0,y:0,width:1024,height:1024))
 NSGraphicsContext.restoreGraphicsState()
 try rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:path))
}
