# [Tutorial_3] 동적 파이프라인(Dynamic Pipeline)

## 1. 전체 코드

```c
#include <gst/gst.h>

#ifdef __APPLE__
#include <TargetConditionals.h>
#endif

/* 모든 정보를 담기 위한 구조체 정의, 콜백에서 전달 가능하도록 함 */ 
typedef struct _CustomData
{
  GstElement *pipeline;
  GstElement *source;
  GstElement *convert;
  GstElement *resample;
  GstElement *sink;
} CustomData;

/* pad-added 시그널에 대한 핸들러 */ 
static void pad_added_handler (GstElement * src, GstPad * pad,
    CustomData * data);

int
tutorial_main (int argc, char *argv[])
{
  CustomData data;
  GstBus *bus;
  GstMessage *msg;
  GstStateChangeReturn ret;
  gboolean terminate = FALSE;

  /* GStreamer 초기화 */ 
  gst_init (&argc, &argv);

  /* Element 생성 */
  data.source = gst_element_factory_make ("uridecodebin", "source");
  data.convert = gst_element_factory_make ("audioconvert", "convert");
  data.resample = gst_element_factory_make ("audioresample", "resample");
  data.sink = gst_element_factory_make ("autoaudiosink", "sink");

  /* 빈 파이프라인 생성 */ 
  data.pipeline = gst_pipeline_new ("test-pipeline");

  if (!data.pipeline || !data.source || !data.convert || !data.resample
      || !data.sink) {
    g_printerr ("Not all elements could be created.\n");
    return -1;
  }

  /* 파이프라인 구성 - source는 아직 연결하지 않음 (나중에 연결) */ 
  gst_bin_add_many (GST_BIN (data.pipeline), data.source, data.convert,
      data.resample, data.sink, NULL);
  if (!gst_element_link_many (data.convert, data.resample, data.sink, NULL)) {
    g_printerr ("Elements could not be linked.\n");
    gst_object_unref (data.pipeline);
    return -1;
  }

  /* 재생할 URI 설정 */ 
  g_object_set (data.source, "uri",
      "https://gstreamer.freedesktop.org/data/media/sintel_trailer-480p.webm",
      NULL);

  /* pad-added 시그널에 연결 */ 
  g_signal_connect (data.source, "pad-added", G_CALLBACK (pad_added_handler),
      &data);

  /* 재생 시작 */ 
  ret = gst_element_set_state (data.pipeline, GST_STATE_PLAYING);
  if (ret == GST_STATE_CHANGE_FAILURE) {
    g_printerr ("Unable to set the pipeline to the playing state.\n");
    gst_object_unref (data.pipeline);
    return -1;
  }

  /* 버스 수신 */ 
  bus = gst_element_get_bus (data.pipeline);
  do {
    msg = gst_bus_timed_pop_filtered (bus, GST_CLOCK_TIME_NONE,
        GST_MESSAGE_STATE_CHANGED | GST_MESSAGE_ERROR | GST_MESSAGE_EOS);

    /* 메시지 처리 */ 
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
          terminate = TRUE;
          break;
        case GST_MESSAGE_EOS:
          g_print ("End-Of-Stream reached.\n");
          terminate = TRUE;
          break;
        case GST_MESSAGE_STATE_CHANGED:
          /* We are only interested in state-changed messages from the pipeline */
          if (GST_MESSAGE_SRC (msg) == GST_OBJECT (data.pipeline)) {
            GstState old_state, new_state, pending_state;
            gst_message_parse_state_changed (msg, &old_state, &new_state,
                &pending_state);
            g_print ("Pipeline state changed from %s to %s:\n",
                gst_element_state_get_name (old_state),
                gst_element_state_get_name (new_state));
          }
          break;
        default:
          /* We should not reach here */
          g_printerr ("Unexpected message received.\n");
          break;
      }
      gst_message_unref (msg);
    }
  } while (!terminate);

  /* 자원 해제 */ 
  gst_object_unref (bus);
  gst_element_set_state (data.pipeline, GST_STATE_NULL);
  gst_object_unref (data.pipeline);
  return 0;
}

/* pad-added 시그널에 의해 호출되는 함수 */ 
static void
pad_added_handler (GstElement * src, GstPad * new_pad, CustomData * data)
{
  GstPad *sink_pad = gst_element_get_static_pad (data->convert, "sink");
  GstPadLinkReturn ret;
  GstCaps *new_pad_caps = NULL;
  GstStructure *new_pad_struct = NULL;
  const gchar *new_pad_type = NULL;

  g_print ("Received new pad '%s' from '%s':\n", GST_PAD_NAME (new_pad),
      GST_ELEMENT_NAME (src));

  /* 이미 링크되었으면 무시 */     
  if (gst_pad_is_linked (sink_pad)) {
    g_print ("We are already linked. Ignoring.\n");
    goto exit;
  }

  /* 새로운 pad의 타입 확인 */ 
  new_pad_caps = gst_pad_get_current_caps (new_pad);
  new_pad_struct = gst_caps_get_structure (new_pad_caps, 0);
  new_pad_type = gst_structure_get_name (new_pad_struct);
  if (!g_str_has_prefix (new_pad_type, "audio/x-raw")) {
    g_print ("It has type '%s' which is not raw audio. Ignoring.\n",
        new_pad_type);
    goto exit;
  }

  /* 링크 시도 */ 
  ret = gst_pad_link (new_pad, sink_pad);
  if (GST_PAD_LINK_FAILED (ret)) {
    g_print ("Type is '%s' but link failed.\n", new_pad_type);
  } else {
    g_print ("Link succeeded (type '%s').\n", new_pad_type);
  }

exit:
  /* 캡스 해제 */ 
  if (new_pad_caps != NULL)
    gst_caps_unref (new_pad_caps);

  /* 싱크 패드 해제 */ 
  gst_object_unref (sink_pad);
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

### 2.1 구조체 정의

```c
/* 콜백에 정보를 전달할 수 있도록 모든 정보를 담는 구조체 */
typedef struct _CustomData {
  GstElement *pipeline;
  GstElement *source;
  GstElement *convert;
  GstElement *resample;
  GstElement *sink;
} CustomData;

```

지금까지는 필요한 정보들(주로 GstElement 에 대한 포인터)을 지역 변수로 저장해왔습니다.

하지만 이 튜토리얼(그리고 대부분의 실제 애플리케이션)에서는 콜백(callback) 이 사용되므로, 모든 데이터를 하나의 구조체로 묶어서 다루기 쉽게 만들었습니다.

### 2.2 요소(Element) 생성

```c
/* 요소 생성 */
data.source = gst_element_factory_make ("uridecodebin", "source");
data.convert = gst_element_factory_make ("audioconvert", "convert");
data.resample = gst_element_factory_make ("audioresample", "resample");
data.sink = gst_element_factory_make ("autoaudiosink", "sink");

```

### [#] uridecodebin

- **`uridecodebin`** 은 내부적으로 소스, **demuxer**, 디코더 등 필요한 모든 요소들을 자동으로
생성하여, URI 를 raw 오디오/비디오 스트림으로 변환합니다.
이는 **playbin** 이 하는 작업의 절반 정도를 수행합니다.
- **`uridecodebin`** 안에는 **demuxer**가 포함되어 있으므로, 처음에는 소스 패드가 존재하지
않으며, 나중에 동적으로 연결해야 합니다.

### [#] audioconvert

- **`audioconvert`** 는 다양한 오디오 포맷 간 변환을 가능하게 하며, 디코더가 출력하는 포맷이 싱크가 기대하는 포맷과 다를 수 있으므로 모든 플랫폼에서 코드가 정상 작동하도록 도와줍니다.

### [#] audioresample

- **`audioresample`** 은 샘플링 레이트가 다른 오디오 간의 변환을 담당하며, 마찬가지로 플랫폼 호환성을 보장합니다.

### [#] autoaudiosink

- **`autoaudiosink`** 는 오디오용 **autovideosink** 로, 시스템의 오디오 카드로 스트림을 출력합니다.

### 2.3 파이프 라인 구성

```c
if (!gst_element_link_many (data.convert, data.resample, data.sink, NULL)) {
  g_printerr ("요소들을 연결할 수 없습니다.\\\\n");
  gst_object_unref (data.pipeline);
  return -1;
}

```

이 부분에서는 **convert**, **resample**, **sink** 를 서로 연결하지만, 아직 **source** 와는 연결하지 않습니다.

왜냐하면 **source** 에는 아직 소스 패드가 없기 때문입니다. 따라서 **convert** ~ **sink** 까지의 브랜치는 나중에 연결할 때까지 남겨둡니다.

### 2.4 재생할 URI 설정

```c
/* 재생할 URI 설정 */
g_object_set (data.source, "uri", "<https://gstreamer.freedesktop.org/data/media/sintel_trailer-480p.webm>", NULL);

```

재생할 파일의 URI 를 설정합니다. 이전 튜토리얼에서처럼 속성(property) 을 이용해 지정합니다.

### 2.5 pad-added 시그널에 연결

```c
/* pad-added 시그널에 연결 */
g_signal_connect (data.source, "pad-added", G_CALLBACK (pad_added_handler), &data);

```

**GSignal** 은 **GStreame**r 에서 매우 중요한 개념입니다.
이 시그널을 통해 콜백을 등록하여, 특정 이벤트(예: 새로운 **pad** 추가)가 발생했을 때 통보받을 수 있습니다.

시그널은 이름(**name**) 으로 식별되며, 각 **GObject** 는 고유한 시그널을 가집니다.

이 줄에서는 **source** 요소( **uridecodebin**)의 "**pad-added**" 시그널에 콜백을 등록합니다.
이를 위해 `g_signal_connect()` 함수를 사용하며, 콜백 함수로 pad_added_handler 를 지정하고 콜백에서 사용할 사용자 정의 데이터(**CustomData**) 구조체 포인터도 함께 전달합니다.

**GStreamer** 는 이 데이터 포인터를 단순히 콜백에 전달만 하고, 내부적으로는 사용하지않습니다.

**GstElement** 가 생성하는 시그널 목록은 해당 요소의 문서를 참조하거나,`gst-inspect- 1.0` 도구를 통해 확인할 수 있습니다. (이 도구는 기초 튜토리얼 10 (**Basic tutorial 10: GStreamer tools**) 에서 자세히 다룹니다.)

이제 모든 준비가 완료되었습니다!
파이프라인을 재생 상태(**GST_STATE_PLAYING**) 로 설정하고, 버스(**bus**) 를 통해 발생하는 메시지들 (예: **ERROR, EOS**) 을 수신하면 됩니다.

이 부분은 이전 튜토리얼들과 동일한 방식입니다.

### 2.6 시그널 콜백 핸들러 함수 작성

```c
static void pad_added_handler (GstElement *src, GstPad *new_pad, CustomData *data)
```

우리의 소스 요소(**source element**)가 충분한 정보를 얻어 데이터 생성을 시작할 수 있게 되면, **GStreamer** 는 소스 패드(**source pads**) 를 생성하고 “**pad-added**” 시그널을 발생시킵니다.

이때 우리의 콜백 함수가 호출됩니다:

- **src** 는 시그널을 발생시킨 **GstElement** 객체입니다. 이 예제에서는 오직 **uridecodebin** 만
시그널에 연결되어 있으므로, src 는 항상 그것입니다.
- 시그널 핸들러의 첫 번째 매개변수는 항상 시그널을 발생시킨 객체입니다.
- **new_pad** 는 방금 src 요소에 추가된 **GstPad** 입니다. 이는 일반적으로 우리가 연결하고자
하는 대상입니다.
- **data** 는 시그널에 연결할 때 우리가 전달한 포인터로, 이 예제에서는 **CustomData** 구조체의 포인터를 전달합니다.

### 2.7 싱크 패드(sink pad) 추출

```c
GstPad *sink_pad = gst_element_get_static_pad (data->convert, "sink");
```

**CustomData** 구조체로부터 **convert** 요소를 추출하고, 그로부터 싱크 패드("sink")를 가져옵니다.

우리는 이 싱크 패드에 **new_pad** 를 연결(link) 하려는 것입니다.
이전 튜토리얼에서는 요소 간 연결만 수행했지만, 이번에는 패드 단위로 직접 연결을 수행합니다.

### 2.8 이미 링크된 경우 중복연결 방지

```c
/* Convert가 이미 링크되어 있으면 작업할 필요 없음 */
if (gst_pad_is_linked (sink_pad)) {
  g_print ("이미 링크되어 있습니다. 무시합니다.\\\\n");
  goto exit;
}
```

`uridecodebin`은 필요한 만큼 많은 패드를 생성할 수 있으며, 패드 하나가 생길 때마다 이 콜백이 호출됩니다.

위 코드는 이미 링크된 경우 중복 연결을 방지하기 위한 조건입니다.

### 2.9 새로 추가된 패드 타입 확인

```c
new_pad_caps = gst_pad_get_current_caps (new_pad, NULL);
new_pad_struct = gst_caps_get_structure (new_pad_caps, 0);
new_pad_type = gst_structure_get_name (new_pad_struct);

if (!g_str_has_prefix (new_pad_type, "audio/x-raw")) {
  g_print ("'%s' 타입은 raw 오디오가 아닙니다. 무시합니다.\\\\n", new_pad_type);
  goto exit;
}
```

이제 이 새로운 패드가 출력하려는 데이터의 타입을 확인합니다.
우리는 오디오 데이터를 처리하는 파이프라인만 구성했기 때문에, 비디오 패드 같은 것은 무시해야 합니다.

- `gst_pad_get_current_caps()`는 해당 패드가 현재 출력할 수 있는 데이터 형식(capabilities) 을 반환합니다.
- 이 정보는 **GstCaps 구조체**로 감싸져 있으며, 여러 개의 형식을 지원하는 경우 여러 개의 **GstStructure** 를 포함할 수 있습니다.
- 하지만 현재 패드의 캡스는 항상 단일 GstStructure 만 가지므로, `gst_caps_get_structure()`로 첫 번째 구조체를 가져옵니다.
- `gst_structure_get_name()`은 해당 구조체의 주된 형식 이름(media type) 을 반환합니다.
- 이 이름이 "**audio/x-raw**"가 아니면, 이는 디코딩된 오디오가 아니므로 무시합니다.

### 2.10 링크 시도

```c
ret = gst_pad_link (new_pad, sink_pad);

if (GST_PAD_LINK_FAILED (ret)) {
  g_print ("'%s' 타입이지만, 링크에 실패했습니다.\\\\n", new_pad_type);
} else {
  g_print ("링크 성공! (타입: '%s')\\\\n", new_pad_type);
}

```

`gst_pad_link()`는 두 개의 패드를 연결하려 시도합니다.

이는 `gst_element_link()`와 유사하지만, 패드 단위로 직접 연결합니다.

- 반드시 소스 → 싱크 방향으로 연결해야 하며, 연결되는 두 패드는 같은 bin(또는 pipeline) 안의 요소에 소속되어야 합니다.

### 2.11 정리

이제 끝났습니다!
원하는 형식의 **pad** 가 등장하면, 그것은 오디오 처리 파이프라인에 연결되고,
이후 파이프라인은 **ERROR** 나 **EOS** 가 발생할 때까지 계속 실행됩니다.

---

### [#] GStreamer의 상태 (States)

우리는 이미 재생이 시작되기 위해서는 파이프라인을 **PLAYING** 상태로 전환해야 한다고
말하면서 GStreamer 의 상태에 대해 약간 언급했습니다.
이번에는 모든 상태와 그 의미에 대해 소개합니다.
GStreamer 에는 총 4 가지 상태가 있습니다:

| 상태 (State) | 설명 |
| --- | --- |
| **NULL** | 요소의 초기 상태 또는 비활성 상태입니다. |
| **READY** | 요소가 `PAUSED` 상태로 전환할 준비가 된 상태입니다. |
| **PAUSED** | 요소가 정지(PAUSED) 상태이며, 데이터를 수신하고 처리할 준비가 되어 있습니다. <br>단, **Sink 요소는 버퍼 하나만 수신하고 이후에는 블로킹**됩니다. |
| **PLAYING** | 요소가 재생 중인 상태이며, **클록(clock)이 작동하고 데이터가 흐르고 있는** 상태입니다. |
- 상태 전환은 인접한 상태 간에만 가능합니다.
- 즉, NULL 에서 바로 PLAYING 으로 갈 수는 없고, 반드시 READY → PAUSED → PLAYING 의 과정을 거쳐야 합니다.
- 하지만 GStreamer 에 PLAYING 상태를 직접 설정하면, 중간 단계는 자동으로 처리됩니다.

### [#] 상태 변화 메시지 다루기

```c
case GST_MESSAGE_STATE_CHANGED:
  /* 파이프라인의 상태 변화 메시지만 관심 있음 */
  if (GST_MESSAGE_SRC (msg) == GST_OBJECT (data.pipeline)) {
    GstState old_state, new_state, pending_state;
	    gst_message_parse_state_changed (msg, &old_state, &new_state, &pending_state);
	    g_print ("파이프라인 상태가 %s에서 %s로 변경되었습니다:\\\\n",
      gst_element_state_get_name (old_state), gst_element_state_get_name (new_state));
  }
  break;

```

우리는 이 코드를 추가하여 버스(bus)로부터 상태 변화 메시지를 수신하고 출력하도록했습니다.
이를 통해 상태 전환 과정을 쉽게 이해할 수 있습니다.

각 요소는 자신이 현재 어떤 상태인지에 대해 버스에 메시지를 전송하므로,
우리는 파이프라인에서 발생하는 메시지만 필터링하여 출력합니다.

대부분의 애플리케이션에서는 다음 세 가지 상태만 신경 쓰면 충분합니다:

- 재생 시작 시 PLAYING 상태
- 일시정지 시 PAUSED 상태
- 프로그램 종료 시 자원 해제를 위한 NULL 상태

## 3. 컴파일 방법

```c
gcc basic-tutorial-3.c -o basic-tutorial-3 `pkg-config --cflags --libs gstreamer-1.0`

```

## 4. 결과

- `basic-tutorial-3`을 실행하면, 지정된 URI에서 오디오와 비디오가 포함된 컨테이너 파일을 로드하고, 오디오 스트림을 추출하여 재생합니다.
- 기본 구현에서는 오디오만 출력되며, 비디오 스트림은 처리되지 않습니다. 비디오 스트림을 처리하려면 튜토리얼의 연습 문제를 참고하여 파이프라인을 확장해야 합니다.

## 5. 결론

이 튜토리얼을 통해 다음 내용을 배웠습니다:

- **GSignals** 를 사용하여 이벤트를 감지하는 방법
- **GstElement** 가 아닌 GstPad 끼리 직접 연결하는 방법
- **GStreamer** 요소의 다양한 상태

또한 이 내용을 바탕으로, 프로그램 시작 시에 고정된 파이프라인이 아닌, 미디어 정보를 받아가며 동적으로 구축되는 파이프라인을 만들어 보았습니다.

이제 다음 단계로 나아가,

- 기초 튜토리얼 4: 시간 관리 (**Time management**) 에서 시킹(seek) 및 시간 관련 질의에 대해
배울 수 있습니다.
- 재생 튜토리얼(**Playback tutorials**) 로 이동하여 playbin 요소에 대해 더 깊이 있는 학습을
진행할 수 있습니다.

이 페이지에는 튜토리얼의 전체 소스 코드와 빌드에 필요한 보조 파일들이 함께 제공되어야
합니다.
함께 해주셔서 감사합니다. 다음에 또 만나요!