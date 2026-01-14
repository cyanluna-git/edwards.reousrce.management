const PADLET_EMBED_URL = 'https://padlet.com/embed/gsskotsami66njvo'

export function RequestBoardPage() {
    return (
        <div className="flex h-full flex-col bg-slate-100">
            <div className="flex-1 overflow-hidden p-0">
                <iframe
                    src={PADLET_EMBED_URL}
                    title="요청 게시판 Padlet"
                    allow="camera;microphone;geolocation;display-capture;clipboard-write"
                    className="h-full w-full border-0"
                    frameBorder="0"
                />
            </div>
        </div>
    )
}
