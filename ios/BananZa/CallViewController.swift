import UIKit
import AVKit
import LiveKit

@MainActor final class CallViewController: UIViewController {
    let coordinator: CallCoordinator
    private let tiles = UIStackView()
    private let status = UILabel()
    private let mic = UIButton(type: .system)
    private let camera = UIButton(type: .system)
    private let notes = UIButton(type: .system)
    private var signature = ""
    private var timer: Timer?
    init(coordinator: CallCoordinator) { self.coordinator = coordinator; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = .systemBackground
        let root = UIStackView(); root.axis = .vertical; root.spacing = 12; root.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(root)
        NSLayoutConstraint.activate([root.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12), root.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12), root.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16), root.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16)])
        status.textAlignment = .center; status.numberOfLines = 0; root.addArrangedSubview(status)
        let scroll = UIScrollView(); root.addArrangedSubview(scroll)
        tiles.axis = .vertical; tiles.spacing = 12; tiles.translatesAutoresizingMaskIntoConstraints = false; scroll.addSubview(tiles)
        NSLayoutConstraint.activate([tiles.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor), tiles.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor), tiles.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor), tiles.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor), tiles.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor)])
        let controls = UIStackView(); controls.distribution = .fillEqually; controls.spacing = 8
        configure(mic, "microphone") { [weak self] in try await self?.coordinator.toggleMicrophone() }
        configure(camera, "camera") { [weak self] in try await self?.coordinator.toggleCamera() }
        controls.addArrangedSubview(mic); controls.addArrangedSubview(camera)
        let flip = UIButton(type: .system); configure(flip, "flip_camera") { [weak self] in try await self?.coordinator.switchCamera() }; controls.addArrangedSubview(flip)
        root.addArrangedSubview(controls)
        let routing = UIStackView(); routing.distribution = .fillEqually
        let route = AVRoutePickerView(); route.accessibilityLabel = L("audio_route"); routing.addArrangedSubview(route)
        let speaker = UIButton(type: .system); configure(speaker, "speaker") {
            let audio = AVAudioSession.sharedInstance()
            try audio.overrideOutputAudioPort(audio.currentRoute.outputs.contains(where: { $0.portType == .builtInSpeaker }) ? .none : .speaker)
        }; routing.addArrangedSubview(speaker); root.addArrangedSubview(routing)
        configure(notes, "ai_notes") { [weak self] in try await self?.coordinator.toggleAiNotes() }; root.addArrangedSubview(notes)
        let minimize = UIButton(type: .system); configure(minimize, "chat") { [weak self] in self?.coordinator.minimize() }; root.addArrangedSubview(minimize)
        let end = UIButton(type: .system); configure(end, "leave_call") { [weak self] in await self?.coordinator.requestEnd() }; end.tintColor = .systemRed; root.addArrangedSubview(end)
        let endAll = UIButton(type: .system); configure(endAll, "end_call") { [weak self] in
            guard let self else { return }
            let alert = UIAlertController(title: L("end_call"), message: nil, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: L("cancel"), style: .cancel))
            alert.addAction(UIAlertAction(title: L("end_call"), style: .destructive) { _ in Task { await self.coordinator.requestEnd(endForEveryone: true) } })
            self.present(alert, animated: true)
        }; root.addArrangedSubview(endAll)
        render()
    }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in Task { @MainActor in self?.render() } }
    }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); timer?.invalidate(); timer = nil }
    private func configure(_ button: UIButton, _ key: String, action: @escaping () async throws -> Void) {
        button.configuration = .tinted(); button.setTitle(L(key), for: .normal)
        button.addAction(UIAction { [weak self] _ in
            Task { do { try await action(); self?.render() } catch {
                let alert = UIAlertController(title: L("error"), message: error.localizedDescription, preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: L("ok"), style: .default)); self?.present(alert, animated: true)
            } }
        }, for: .touchUpInside)
    }
    func render() {
        guard isViewLoaded else { return }
        let room = coordinator.room
        status.text = (coordinator.call["chat_name"] as? String ?? "BananZa") + "\n" + L(coordinator.connected ? "connected" : "connecting")
        mic.isSelected = room.localParticipant.isMicrophoneEnabled(); camera.isSelected = room.localParticipant.isCameraEnabled()
        mic.setTitle(L(mic.isSelected ? "mute" : "unmute"), for: .normal)
        camera.setTitle(L(camera.isSelected ? "camera_off" : "camera_on"), for: .normal)
        camera.isHidden = coordinator.call["media_kind"] as? String == "voice"
        notes.setTitle(L((coordinator.call["ai_notes"] as? [String: Any])?["status"] as? String == "recording" ? "stop_ai_notes" : "ai_notes"), for: .normal)
        let people: [Participant] = [room.localParticipant] + room.remoteParticipants.values.sorted { ($0.name ?? "") < ($1.name ?? "") }
        let key = people.map { person in (person.identity?.stringValue ?? "local") + (person.name ?? "") + person.videoTracks.map { $0.sid.stringValue + String($0.isMuted) + String($0.track != nil) }.joined() }.joined(separator: "|")
        guard key != signature else { return }; signature = key
        tiles.arrangedSubviews.forEach { tiles.removeArrangedSubview($0); $0.removeFromSuperview() }
        for person in people {
            let label = UILabel(); label.text = person.name ?? L("participant"); tiles.addArrangedSubview(label)
            for publication in person.videoTracks where !publication.isMuted {
                guard let track = publication.track as? VideoTrack else { continue }
                let video = VideoView(); video.track = track; video.heightAnchor.constraint(equalToConstant: 220).isActive = true
                video.accessibilityLabel = publication.source == .screenShareVideo ? L("screen_share") : (person.name ?? L("participant"))
                tiles.addArrangedSubview(video)
            }
        }
    }
}
