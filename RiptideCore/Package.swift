// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "RiptideCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "RiptideCore", targets: ["RiptideCore"])],
    targets: [
        .target(name: "RiptideCore", resources: [.process("Resources")]),
        .testTarget(name: "RiptideCoreTests", dependencies: ["RiptideCore"])
    ]
)
