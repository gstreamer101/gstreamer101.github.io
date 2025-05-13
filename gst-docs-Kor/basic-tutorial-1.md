# [Tutorial_1] Hello World

## 1. 전체 코드

```c
#include <gst/gst.h> 

#ifdef __APPLE__ 
#include <TargetConditionals.h> 
#endif 

int 
tutorial_main (int argc, char *argv[]) 
{ 
	GstElement *pipeline; 
	GstBus *bus; 
	GstMessage *msg; 
	
	/* GStreamer 초기화 */ 
	gst_init (&argc, &argv); 
	
	/* 파이프라인 생성 */ 
	pipeline = 
	gst_parse_launch 
	("playbin uri=https://gstreamer.freedesktop.org/data/media/sintel_trailer-480p.webm", 
		NULL); 
	
	/* 재생 시작 */ 
	gst_element_set_state (pipeline, GST_STATE_PLAYING); 
	
	/* 오류 또는 EOS(End Of Stream)를 기다림 */ 
	bus = gst_element_get_bus (pipeline); 
	msg = 
	gst_bus_timed_pop_filtered (bus, GST_CLOCK_TIME_NONE, 
		GST_MESSAGE_ERROR | GST_MESSAGE_EOS); 
	
	/* 에러 메시지 처리 - 다음 튜토리얼에서 자세히 다룸 */ 
	if (GST_MESSAGE_TYPE (msg) == GST_MESSAGE_ERROR) { 
		g_printerr ("An error occurred! Re-run with the GST_DEBUG=*:WARN "
			"environment variable set for more details.\n");
	} 
	
	/* 자원 해제 */ 
	gst_message_unref (msg); 
	gst_object_unref (bus); 
	gst_element_set_state (pipeline, GST_STATE_NULL); 
	gst_object_unref (pipeline); 
	return 0; 
} 

int 
main (int argc, char *argv[]) 
{ 
#if defined(__APPLE__) && TARGET_OS_MAC && !TARGET_OS_IPHONE 
	return gst_macos_main ((GstMainFunc) tutorial_main, argc, argv, NULL); 
#else 
	return tutorial_main (argc, argv); 
#endif 
} 
```

## 2. 코드 분석

### 2.1 GStreamer 초기화

```c
/* GStreamer 초기화 */ 
gst_init (&argc, &argv); 
```

이 코드는 항상 GStreamer 애플리케이션에서 가장 먼저 실행되어야 하는 명령어입니다.
`gst_init() 함수`는 다음 작업을 수행합니다:

- 내부 구조 초기화
- 사용 가능한 플러그인 확인
- GStreamer 관련 명령줄 옵션 실행

`argc`, `argv` 를 그대로 `gst_init()`에 넘기면, 
GStreamer 표준 명령줄 옵션이 자동으로 동작하게 됩니다.

### 2.2 파이프라인 생성

```c
/* 파이프라인 생성 */ 
pipeline = 
    gst_parse_launch( 
      "playbin uri=https://gstreamer.freedesktop.org/data/media/sintel_trailer-480p.webm", 
      NULL); 
```

Basic Tutorial 1은 GStreamer의 핵심 개념 중 하나인 파이프라인 생성 과정을 이해하는 데 중점을 둔 예제입니다

### 2.2.1 gst_parse_launch

GStreamer 는 멀티미디어 데이터 흐름을 처리하도록 설계된 프레임워크입니다.
미디어는 “소스(source)” 요소(생산자)에서 시작되어 “싱크(sink)” 요소(소비자)로 이동하며, 그 사이에 다양한 작업을 수행하는 중간 요소들을 거칩니다.
이렇게 연결된 전체 요소들의 집합을 파이프라인(pipeline) 이라고 부릅니다.

일반적으로는 각 요소를 직접 조립하여 파이프라인을 구성하지만, 간단한 파이프라인이라면 굳이 복잡하게 구성할 필요 없이,
`gst_parse_launch()`를 통해 문자열로 파이프라인을 정의할 수 있습니다.
이 함수는 문자열로 작성된 파이프라인 표현을 실제 동작 가능한 파이프라인 객체로 변환해줍니다.

### 2.2.2 playbin

그렇다면, `gst_parse_launch()`에게 어떤 종류의 파이프라인을 만들라고 요청하고 있는 걸까요?
여기서 두 번째 핵심 개념이 등장합니다: 우리는 playbin 이라는 단일 요소로 구성된 파이프라인을 만들고 있습니다.
playbin 은 소스(Source) 이자 싱크(Sink) 역할을 모두 수행하는 특수한 요소로, 하나의 완전한 파이프라인이라고 볼 수 있습니다.
내부적으로는 미디어 재생에 필요한 모든 요소들을 생성하고 연결해주기 때문에, 사용자가 일일이 구성하지 않아도 됩니다.
물론 수동 파이프라인처럼 세밀한 제어는 어렵지만, 다양한 애플리케이션에서 충분히 사용할 수 있을 만큼의 커스터마이징 기능은 제공합니다.

원하는 미디어 URI 로 변경해보세요
[http://이든](http://xn--ly1b856a/) file://이든, playbin 이 알아서 적절한 GStreamer 소스를 생성해줍니다.

### 2.3 재생시작

```c
/* 재생 시작 */ 
gst_element_set_state (pipeline, GST_STATE_PLAYING); 
```

이 줄에서는 또 하나의 중요한 개념, "상태(state)" 를 보여줍니다.
모든 GStreamer 요소는 특정 상태를 가지며, 이를 일반적인 DVD 플레이어의 재생/일시정지 버튼처럼 생각할 수 있습니다.

지금 단계에서는 단순히 다음만 기억하면 됩니다:
파이프라인을 PLAYING 상태로 설정하지 않으면 재생이 시작되지 않습니다.

여기서는 `gst_element_set_state()` 함수를 통해
pipeline (이 예제의 유일한 요소(Element))을 GST_STATE_PLAYING 상태로 설정하여 재생을 시작하고 있습니다.

### 2.4 오류 또는 EOS(End of Stream)을 기다림

```c
/* 오류 또는 EOS(스트림 종료)까지 대기 */ 
bus = gst_element_get_bus (pipeline); 
msg = 
    gst_bus_timed_pop_filtered (bus, GST_CLOCK_TIME_NONE, 
    GST_MESSAGE_ERROR | GST_MESSAGE_EOS); 
```

이 줄은 오류가 발생하거나 스트림이 종료될 때까지 기다리는 코드입니다.

- `gst_element_get_bus()`는 파이프라인의 버스(bus) 를 가져옵니다.
- `gst_bus_timed_pop_filtered()`는 오류(ERROR) 또는 스트림 종료(EOS) 메시지가 올때까지 블로킹 상태로 대기합니다.

### 2.5 자원 해제

```c
/* 자원 해제 */ 
gst_message_unref (msg); 
gst_object_unref (bus); 
gst_element_set_state (pipeline, GST_STATE_NULL); 
gst_object_unref (pipeline); 
return 0; 
```

사용하는 함수의 문서를 반드시 참고하여,
반환된 객체를 해제해야 하는지 꼭 확인하세요.

- gst_bus_timed_pop_filtered()는 메시지를 반환하며, 이 메시지는 gst_message_unref()로 해제해야 합니다.
- (메시지에 대한 자세한 내용은 기본 튜토리얼 2 에서 다룹니다)
- `gst_element_get_bus()`는 bus 객체의 참조를 증가시키므로, 사용후에는 `gst_object_unref()`로 해제해야 합니다.
- `gst_element_set_state()`를 GST_STATE_NULL 로 호출하면, 파이프라인이 사용 중인 모든 리소스를 정리합니다. (상태에 대한 더 자세한 내용은 기본 튜토리얼 3: 동적 파이프라인에서 설명됩니다)
- 마지막으로 pipeline 객체에 대한 참조를 해제하면, 파이프라인 및 그 안의 모든 요소들이 파괴(destroy) 됩니다.

## 3. 컴파일 방법

```c
gcc basic-tutorial-1.c -o basic-tutorial-1 `pkg-config --cflags --libs gstreamer-1.0`

```

## 4. 결과

![image.png](attachment:f517a47c-c723-4d60-b71b-b813a8491d3b:image.png)
