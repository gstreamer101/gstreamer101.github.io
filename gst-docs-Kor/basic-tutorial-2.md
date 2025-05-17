# [Tutorial_2] GStreamer 개념

## 1. 전체 코드

```c
#include <gst/gst.h> 

#ifdef __APPLE__ 
#include <TargetConditionals.h> 
#endif 

int 
tutorial_main (int argc, char *argv[]) 
{ 
	GstElement *pipeline, *source, *sink; 
	GstBus *bus; 
	GstMessage *msg; 
	GstStateChangeReturn ret; 
	
	/* GStreamer 초기화 */ 
	gst_init (&argc, &argv); 
	
	/* 요소 생성 */ 
	source = gst_element_factory_make ("videotestsrc", "source"); 
	sink = gst_element_factory_make ("autovideosink", "sink"); 
	
	/* 빈 파이프라인 생성 */ 
	pipeline = gst_pipeline_new ("test-pipeline"); 
	
	if (!pipeline || !source || !sink) { 
		g_printerr ("Not all elements could be created.\n"); 
		return -1; 
	} 
	
	/* 파이프라인 구성 */ 
	gst_bin_add_many (GST_BIN (pipeline), source, sink, NULL); 
	if (gst_element_link (source, sink) != TRUE) { 
		g_printerr ("Elements could not be linked.\n"); 
		gst_object_unref (pipeline); 
		return -1; 
	} 
	
	/* 소스 요소의 속성 설정 */ 
	g_object_set (source, "pattern", 0, NULL); 
	
	/* 재생 시작 */ 
	ret = gst_element_set_state (pipeline, GST_STATE_PLAYING); 
	if (ret == GST_STATE_CHANGE_FAILURE) { 
		g_printerr ("Unable to set the pipeline to the playing state.\n"); 
		gst_object_unref (pipeline); 
		return -1; 
	} 
	
	/* 오류 또는 EOS까지 대기 */ 
	bus = gst_element_get_bus (pipeline); 
	msg = gst_bus_timed_pop_filtered (bus, GST_CLOCK_TIME_NONE, 
		GST_MESSAGE_ERROR | GST_MESSAGE_EOS); 
	
	/* 메시지 파싱 */ 
	if (msg != NULL) { 
		GError *err; 
		gchar *debug_info; 
		
		switch (GST_MESSAGE_TYPE (msg)) { 
			case GST_MESSAGE_ERROR: 
			gst_message_parse_error (msg, &err, &debug_info); 
			g_printerr ("Error received from element %s: %s\n", 
				GST_OBJECT_NAME (msg->src), err->message); 
			g_printerr ("Debugging information: %s\n", 
				debug_info ? debug_info : "none"); 
			g_clear_error (&err); 
			g_free (debug_info); 
			break; 
			case GST_MESSAGE_EOS: 
			g_print ("End-Of-Stream reached.\n"); 
			break; 
			default: 
			/* 오류 또는 EOS만 요청했기 때문에 이 경우는 발생하면 안 됩니다 */ 
			g_printerr ("Unexpected message received.\n"); 
			break; 
		} 
		gst_message_unref (msg); 
	} 
	
	/* 자원 해제 */ 
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

### 2.1 요소 생성

```c
/* 요소 생성 */ 
source = gst_element_factory_make ("videotestsrc", "source"); 
sink = gst_element_factory_make ("autovideosink", "sink"); 
```

위 코드에서 볼 수 있듯이, 새로운 요소는 `gst_element_factory_make()` 함수를 사용하여 생성할수 있습니다.

- 첫 번째 매개변수는 생성할 요소의 타입입니다.
    - (※ 기본 튜토리얼 14: 유용한 요소들(Handy elements) 에서 자주 사용되는 요소들을다루고, 기본 튜토리얼 10: GStreamer 도구에서는 사용 가능한 모든 요소 타입의 목록을 얻는방법을 소개합니다.)
- 두 번째 매개변수는 이 요소 인스턴스에 부여할 이름입니다.
    - 요소에 이름을 부여하면, 나중에 포인터를 따로 저장하지 않았더라도 이름을 통해요소를 검색할 수 있고,디버그 메시지도 더 명확하게 출력됩니다.
    - 만약 이름에 NULL 을 전달하면, GStreamer 가 자동으로 고유한 이름을 부여합니다.

이 튜토리얼에서는 두 개의 요소를 생성합니다:

- videotestsrc : 비디오 테스트 신호 소스
- autovideosink : 자동으로 비디오 출력 싱크를 선택

중간에 필터 요소는 없습니다.
따라서 파이프라인은 다음과 같은 구조가 됩니다:

```c
videotestsrc ───▶ autovideosink 
```

![](https://github.com/dlgus8648/gstreamer101.github.io/blob/practice/image/basic_tutorial_2.png)

### [#] videotestsrc

- videotestsrc 는 소스 요소(source element) 입니다.
- 즉, 데이터를 생성하는 요소이며, 테스트용 비디오 패턴을 생성합니다.
- 이 요소는 주로 디버깅 목적이나 튜토리얼에서 유용하게 사용되며, 일반적인 실제애플리케이션에서는 보통 사용되지 않습니다.

### [#] autovideosink

- autovideosink 는 싱크 요소(sink element) 로, 데이터를 소비하며 받은 영상을 창에 표시합니다.
- 운영체제에 따라 다양한 비디오 싱크 요소들이 존재하고, 그 기능도 조금씩 다릅니다.
- autovideosink 는 이들 중 가장 적합한 것을 자동으로 선택하고 생성해주므로, 개발자는 세부 사항을 신경 쓰지 않아도 되며, 플랫폼 독립적인 코드 작성이 가능합니다.

### 2.2 빈 파이프라인 생성

```c
	/* 빈 파이프라인 생성 */ 
pipeline = gst_pipeline_new ("test-pipeline"); 

if (!pipeline || !source || !sink) { 
	g_printerr ("Not all elements could be created.\n"); 
	return -1; 
} 
```

GStreamer 에서는 모든 요소들이 반드시 파이프라인 안에 포함되어야만 사용할 수 있습니다.

파이프라인은 요소들 사이의 클럭(clock)과 메시징 기능을 관리하기 때문입니다.

`gst_pipeline_new()`를 통해 파이프라인을 생성합니다.

### 2.3 파이프라인 구성 (요소 추가 및 연결)

```c
/* 파이프라인 구성 */ 
gst_bin_add_many (GST_BIN (pipeline), source, sink, NULL); 
if (gst_element_link (source, sink) != TRUE) { 
	g_printerr ("Elements could not be linked.\n"); 
	gst_object_unref (pipeline); 
	return -1; 
} 
```

파이프라인(Pipeline) 은 빈(Bin) 의 일종으로, 다른 요소들을 포함할 수 있는 GStreamer 요소입니다.
따라서 bin 에 적용되는 모든 메서드는 pipeline 에도 적용됩니다.

이 코드에서는 gst_bin_add_many()를 호출하여 요소들을 파이프라인에 추가합니다. 

(※ GST_BIN(pipeline)으로 형변환(casting) 해주는 것에 주의하세요)
이 함수는 여러 개의 요소들을 한꺼번에 추가할 수 있으며, NULL 로 끝나는
리스트 형식입니다.
하나씩 추가하고 싶을 경우에는 gst_bin_add()를 사용할 수 있습니다.

하지만 요소들을 파이프라인에 추가했다고 해서 자동으로 연결되는 것은 아닙니다.
따라서 `gst_element_link()`를 사용하여 명시적으로 요소 간 연결을 설정해야 합니다.

- 첫 번째 매개변수는 소스(source) 요소
- 두 번째 매개변수는 목적지(=sink) 요소입니다.

### [#] 순서가 매우 중요합니다.

데이터 흐름 방향(소스 → 싱크)에 맞게 연결해야 합니다.
같은 bin 안에 있는 요소들끼리만 연결이 가능하므로,연결 전에 반드시 파이프라인에 요소들을 먼저 추가해야 합니다.

### 2.4 소스 요소(Source Element)의 속성 변경

```c
/* 소스 요소의 속성 변경 */ 
g_object_set (source, "pattern", 0, NULL); 
```

이 줄은 videotestsrc 요소의 "pattern" 속성을 변경합니다.
이 속성은 이 요소가 출력할 테스트 비디오의 종류를 결정합니다.

### [#] 속성(Properties)란

GStreamer 의 요소들은 모두 GObject 의 특수한 형태입니다.
GObject 는 속성(property) 기능을 제공하는 객체 시스템입니다.

대부분의 GStreamer 요소들은 사용자가 설정할 수 있는 속성들을 가지고 있습니다.
속성이란, 요소의 동작을 제어하기 위해 변경할 수 있는 이름이 붙은 속성값(writable properties) 이거나, 요소의 내부 상태를 확인하기 위한 읽기 전용 속성(readable properties) 을 의미합니다.

속성을 읽을 때는 `g_object_get()` 함수를 사용하고, 속성을 설정(변경)할 때는 `g_object_set()`함수를 사용합니다.

`g_object_set()` 함수는 속성 이름과 값 쌍의 리스트를 NULL 로 끝맺는 형식으로 받기 때문에, 한 번에 여러 개의 속성을 설정할 수도 있습니다.
이러한 속성 제어 함수들에 `g_ `접두사가 붙는 이유는 GObject 라이브러리에서 제공되기 때문입니다.

### [#] 요소(Element)가 제공하는 속성 확인 방법

요소가 제공하는 모든 속성의 이름과 설정 가능한 값 목록은
다음 방법으로 확인할 수 있습니다:

- **기본 튜토리얼 10: GStreamer 도구**에서 설명하는 `gst-inspect-1.0 `명령어 사용
- 또는 해당 요소의 공식 문서 확인
(예: videotestsrc 요소에 대한 문서)

### 2.5 재생 시작 & 오류확인(Error Checking)

```c
/* 재생 시작 */ 
ret = gst_element_set_state (pipeline, GST_STATE_PLAYING); 
if (ret == GST_STATE_CHANGE_FAILURE) { 
	g_printerr ("Unable to set the pipeline to the playing state.\n"); 
	gst_object_unref (pipeline); 
	return -1; 
} 
```

우리는 `gst_element_set_state()`를 호출하지만, 이번에는 그 반환 값을 검사하여 오류를 확인합니다.
상태 변경은 매우 섬세한 과정이므로, 그에 관한 추가적인 설명은 **기본 튜토리얼 3: 동적 파이프라인**에서 확인할 수 있습니다.

### 2.6. 메시지 파싱

```c
/* 오류 또는 EOS까지 대기 */ 
	bus = gst_element_get_bus (pipeline); 
	msg = gst_bus_timed_pop_filtered (bus, GST_CLOCK_TIME_NONE, 
		GST_MESSAGE_ERROR | GST_MESSAGE_EOS); 
	
	/* 메시지 파싱 */ 
	if (msg != NULL) { 
		GError *err; 
		gchar *debug_info; 
		
		switch (GST_MESSAGE_TYPE (msg)) { 
			case GST_MESSAGE_ERROR: 
			gst_message_parse_error (msg, &err, &debug_info); 
			g_printerr ("Error received from element %s: %s\n", 
				GST_OBJECT_NAME (msg->src), err->message); 
			g_printerr ("Debugging information: %s\n", 
				debug_info ? debug_info : "none"); 
			g_clear_error (&err); 
			g_free (debug_info); 
			break; 
			case GST_MESSAGE_EOS: 
			g_print ("End-Of-Stream reached.\n"); 
			break; 
			default: 
			/* 오류 또는 EOS만 요청했기 때문에 이 경우는 발생하면 안 됩니다 */ 
			g_printerr ("Unexpected message received.\n"); 
			break; 
		} 
		gst_message_unref (msg); 
	} 
	
```

`gst_bus_timed_pop_filtered()` 함수는 실행이 종료될 때까지 대기하며,
이전에 무시했던 GstMessage 를 반환합니다.

우리는 `gst_bus_timed_pop_filtered()`에 GStreamer 가 오류 조건이나 EOS 중 하나에 도달했을 때 반환하도록 요청했으므로, 어느 경우가 발생했는지를 확인하고 화면에 메시지를 출력해야 합니다.
(실제 애플리케이션에서는 보다 복잡한 동작을 수행할 수 있습니다.)
GstMessage 는 거의 모든 종류의 정보를 전달할 수 있는 매우 다재다능한 구조체입니다.
다행히 GStreamer 는 메시지의 종류별로 파싱 함수들을 제공합니다.

이 경우, 메시지가 오류를 포함하고 있음을 (`GST_MESSAGE_TYPE()` 매크로를 사용하여) 알게 되면, `gst_message_parse_error()` 함수를 사용하여 GLib 의 GError 오류 구조체와 디버깅에 유용한 문자열을 얻을 수 있습니다.

코드를 살펴보면, 이들이 어떻게 사용되고 이후에 해제되는지 확인할 수 있습니다.

### [#]GStreamer 버스(The GStreamer bus) 란

이 시점에서 GStreamer 버스에 대해 조금 더 정식으로 소개할 필요가 있습니다.
버스는 GStreamer 요소들이 생성한 GstMessage 를 애플리케이션으로 전달하는 역할을 하며,
순서대로, 그리고 애플리케이션 스레드에서 메시지를 전달합니다.

이 마지막 점이 특히 중요합니다.
왜냐하면 미디어 스트리밍은 애플리케이션과는 다른 스레드에서 수행되기 때문입니다.

메시지는 다음 두 가지 방식으로 버스에서 추출할 수 있습니다:

- 동기식 방식: `gst_bus_timed_pop_filtered()` 및 관련 함수들 사용
• 비동기식 방식: 시그널(signal) 을 사용 (다음 튜토리얼에서 설명됩니다)

애플리케이션은 항상 버스를 모니터링 하여, 오류나 재생 관련 문제들을 즉시 감지할 수
있도록 해야 합니다.

### 2.7 자원 해제

```c
	/* 자원 해제 */ 
	gst_message_unref (msg); 
	gst_object_unref (bus); 
	gst_element_set_state (pipeline, GST_STATE_NULL); 
	gst_object_unref (pipeline); 
	return 0; 
```

나머지 코드는 리소스를 정리(cleanup)하는 부분으로, 이는 **기본 튜토리얼 1: Hello world!** 와 동일합니다.

## 3. 컴파일 방법

```c
gcc basic-tutorial-2.c -o basic-tutorial-2 `pkg-config --cflags --libs gstreamer-1.0` 
```

## 4. 결과

![](https://github.com/dlgus8648/gstreamer101.github.io/blob/practice/image/basic_tutorial_2_result.jpg)

## 6. 결론

이번 튜토리얼에서는 다음 내용을 배웠습니다:

- `gst_element_factory_make()`를 사용하여 요소를 생성하는 방법
- `gst_pipeline_new()`를 사용하여 빈 파이프라인을 생성하는 방법
- `gst_bin_add_many()`로 요소들을 파이프라인에 추가하는 방법
- `gst_element_link()`를 사용하여 요소들을 연결하는 방법

이로써 GStreamer 기본 개념에 집중된 두 개의 튜토리얼 중 첫 번째가 완료되었습니다. 
두 번째 튜토리얼이 바로 이어집니다.

함께해 주셔서 감사합니다. 다음 튜토리얼에서 또 뵙겠습니다!

## 7. 연습 문제

연습해보고 싶다면 다음 문제에 도전해보세요:

소스와 싱크 사이에 비디오 필터 요소를 하나 추가해보세요.
vertigotv 라는 필터를 사용하면 멋진 시각 효과를 볼 수 있습니다.

단, 플랫폼이나 설치된 플러그인에 따라
"협상(negotiation) 오류" 가 발생할 수 있습니다.
이는 싱크 요소가 필터가 출력하는 포맷을 이해하지 못할 때 발생합니다.
(※ 협상에 대한 자세한 내용은 기본 튜토리얼 6: 미디어 포맷과 Pad 기능 참고)

이 경우에는 필터 뒤에 videoconvert 요소를 추가해보세요.
즉, 총 4 개의 요소로 구성된 파이프라인을 만들어야 합니다.
(※ videoconvert 에 대한 설명은 기본 튜토리얼 14: 유용한 요소들 참고)
