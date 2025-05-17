# [Tutorial_1] Hello World (Python)

## 1. 전체 코드

```python
import sys
import gi

gi.require_version('GLib', '2.0')
gi.require_version('GObject', '2.0')
gi.require_version('Gst', '1.0')

from gi.repository import Gst, GObject, GLib

pipeline = None
bus = None
message = None

# initialize GStreamer
Gst.init(sys.argv[1:])

# build the pipeline
pipeline = Gst.parse_launch(
    "playbin uri=https://gstreamer.freedesktop.org/data/media/sintel_trailer-480p.webm"
)

# start playing
pipeline.set_state(Gst.State.PLAYING)

# wait until EOS or error
bus = pipeline.get_bus()
msg = bus.timed_pop_filtered(
    Gst.CLOCK_TIME_NONE,
    Gst.MessageType.ERROR | Gst.MessageType.EOS
)

# free resources
pipeline.set_state(Gst.State.NULL)
```

## 2. 코드 분석

### 2.1 필요한 라이브러리 임포트

```python
import sys
import gi

gi.require_version('GLib', '2.0')
gi.require_version('GObject', '2.0')
gi.require_version('Gst', '1.0')

from gi.repository import Gst, GObject, GLib
```

Python에서 GStreamer를 사용하기 위해서는 PyGObject 라이브러리를 통해 접근합니다. PyGObject는 GObject 기반 라이브러리를 Python에서 사용할 수 있게 해주는 바인딩입니다.

- `gi.require_version()` 함수는 사용할 라이브러리의 버전을 명시합니다.
- `GLib`: GLib 기본 유틸리티 라이브러리 (2.0 버전)
- `GObject`: GObject 객체 시스템 (2.0 버전)
- `Gst`: GStreamer 코어 (1.0 버전)
- `from gi.repository import...`: 실제 모듈을 가져옵니다.

### 2.2 GStreamer 초기화

```python
# initialize GStreamer
Gst.init(sys.argv[1:])
```

GStreamer 애플리케이션에서는 항상 가장 먼저 GStreamer를 초기화해야 합니다. 
이 함수는 다음과 같은 작업을 수행합니다:

- GStreamer의 내부 구조를 초기화합니다.
- 시스템에서 사용 가능한 모든 플러그인을 검색합니다.
- GStreamer 관련 명령줄 옵션을 처리합니다.

`sys.argv[1:]`를 전달함으로써, 프로그램 실행 시 입력된 GStreamer 관련 명령줄 옵션을 처리할 수 있게 합니다.

### 2.3 파이프라인 생성

```python
# build the pipeline
pipeline = Gst.parse_launch(
    "playbin uri=https://gstreamer.freedesktop.org/data/media/sintel_trailer-480p.webm"
)
```

GStreamer의 핵심 개념 중 하나인 파이프라인을 생성합니다. 파이프라인은 미디어 데이터가 흐르는 경로로, 여러 요소들이 연결된 구조입니다.

`Gst.parse_launch()` 함수는 문자열로 파이프라인을 정의할 수 있게 해주는 편리한 방법입니다. 이 함수는 파이프라인 정의 문자열을 파싱하여 실제 동작하는 파이프라인을 생성합니다.

이 예제에서는 `playbin`이라는 특별한 요소를 사용합니다. `playbin`은 미디어 재생에 필요한 모든 요소를 자동으로 생성하고 연결하는 "all-in-one" 요소입니다. 이것은 소스(source)에서 싱크(sink)까지 필요한 모든 요소를 포함하는 완전한 파이프라인입니다.

`playbin`에 `uri` 속성으로 재생할 미디어의 위치를 지정합니다. 이 예제에서는 웹에서 호스팅되는 WebM 형식의 동영상을 재생합니다.

### 2.4 재생 시작

```python
# start playing
pipeline.set_state(Gst.State.PLAYING)
```

GStreamer 요소와 파이프라인은 여러 "상태(State)"를 가질 수 있습니다. 이 상태는 DVD 플레이어의 재생, 일시정지, 정지 버튼과 유사한 개념입니다.

이 코드는 파이프라인을 `PLAYING` 상태로 변경하여 미디어 재생을 시작합니다. 파이프라인이 `PLAYING` 상태가 되면 데이터 처리를 시작하고 미디어가 재생됩니다.

`Gst.State.PLAYING`은 Python에서 GStreamer 상태를 나타내는 열거형 상수입니다.

### 2.5 오류 또는 EOS(End Of Stream) 기다리기

```python
# wait until EOS or error
bus = pipeline.get_bus()
msg = bus.timed_pop_filtered(
    Gst.CLOCK_TIME_NONE,
    Gst.MessageType.ERROR | Gst.MessageType.EOS
)
```

GStreamer는 "버스(Bus)" 시스템을 통해 요소들 간의 통신을 처리합니다. 버스는 파이프라인이나 요소에서 발생하는 메시지(상태 변경, 오류, 스트림 종료 등)를 애플리케이션에 전달합니다.

이 코드는:
1. `pipeline.get_bus()`를 통해 파이프라인의 버스를 가져옵니다.
2. `bus.timed_pop_filtered()`를 사용하여 특정 유형의 메시지가 도착할 때까지 기다립니다.
   - `Gst.CLOCK_TIME_NONE`: 무한정 기다립니다(타임아웃 없음).
   - `Gst.MessageType.ERROR | Gst.MessageType.EOS`: ERROR(오류) 또는 EOS(스트림 종료) 메시지가 도착할 때까지 기다립니다.

이 함수는 지정된 타입의 메시지가 도착할 때까지 프로그램 실행을 블록합니다. 영상이 끝나거나 오류가 발생할 때까지 기다리는 것입니다.

### 2.6 자원 해제

```python
# free resources
pipeline.set_state(Gst.State.NULL)
```

프로그램 종료 전에 GStreamer 자원을 적절히.

파이프라인을 `NULL` 상태로 설정함으로써 모든 리소스를 정리합니다. `NULL` 상태는 파이프라인이 아무 작업도 하지 않는 초기 상태입니다.

C 코드와는 달리, Python에서는 참조 카운팅과 가비지 컬렉션이 자동으로 처리되기 때문에 명시적인 `unref` 호출이 필요하지 않습니다. 객체 참조가 더 이상 사용되지 않으면 Python의 가비지 컬렉터가 자동으로 해당 자원을 정리합니다.

## 3. 실행 방법

이 코드를 실행하려면 다음 요구사항이 필요합니다:

1. Python 3 설치
2. GStreamer 1.0 설치
3. PyGObject 설치

### 3.1 필요 패키지 설치

Ubuntu/Debian 기반 시스템:
```bash
sudo apt-get install python3-gi python3-gst-1.0 gstreamer1.0-plugins-good
```

Fedora:
```bash
sudo dnf install python3-gobject python3-gstreamer1 gstreamer1-plugins-good
```

macOS (Homebrew 사용):
```bash
brew install pygobject3 gstreamer gst-plugins-good
```

Windows:
MSYS2를 통해 설치하거나, GStreamer 공식 웹사이트에서 Windows 바이너리를 다운로드하세요.

### 3.2 코드 실행

코드를 `basic-tutorial-1.py` 파일로 저장한 후 다음 명령으로 실행합니다:

```bash
python3 basic-tutorial-1.py
```

## 4. 결과

코드가 성공적으로 실행되면 "Sintel" 영화의 트레일러가 재생됩니다. 영상 재생이 끝나면 프로그램이 종료됩니다.

## 5. C 코드와의 비교

Python 버전은 C 코드보다 간결하지만 동일한 기능을 수행합니다. 주요 차이점:

1. **메모리 관리**: C 코드는 명시적인 참조 해제(`unref`)가 필요하지만, Python은 자동으로 처리합니다.
2. **문법**: Python은 객체 지향적 접근방식을 사용하여 더 간결한 코드를 제공합니다.
3. **타입 시스템**: Python은 동적 타이핑을 사용하므로 변수 선언이 더 간단합니다.
4. **오류 처리**: 이 예제에서는 구현되지 않았지만, Python에서는 try-except를 통한 예외 처리가 더 자연스럽습니다.

두 버전 모두 동일한 GStreamer 기능을 사용하며, 동일한 개념(파이프라인, 요소, 버스, 상태 등)을 다룹니다.
