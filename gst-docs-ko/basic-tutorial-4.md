# [Tutorial_4] **Time management**

## 1. 전체 코드

```c
#include <gst/gst.h>

/* 필요한 정보를 담는 구조체 정의 */ 
typedef struct _CustomData {
  GstElement *playbin;   /* 하나뿐인 요소 */ 
  gboolean playing;      /* 현재 PLAYING 상태인지 여부 */ 
  gboolean terminate;    /* 종료 여부 */
  gboolean seek_enabled; /* 시킹 지원 여부 */ 
  gboolean seek_done;    /* 시킹 수행 여부 */ 
  gint64 duration;       /* 미디어의 전체 길이 (나노초 단위) */ 
} CustomData;

/* 메시지 처리 함수 정의 */ 
static void handle_message (CustomData *data, GstMessage *msg);

int main(int argc, char *argv[]) {
  CustomData data;
  GstBus *bus;
  GstMessage *msg;
  GstStateChangeReturn ret;

  data.playing = FALSE;
  data.terminate = FALSE;
  data.seek_enabled = FALSE;
  data.seek_done = FALSE;
  data.duration = GST_CLOCK_TIME_NONE;

  /* GStreamer 초기화 */ 
  gst_init (&argc, &argv);

  /* 요소 생성 */ 
  data.playbin = gst_element_factory_make ("playbin", "playbin");

  if (!data.playbin) {
    g_printerr ("Not all elements could be created.\n");
    return -1;
  }

  /* 재생할 URI 설정 */ 
  g_object_set (data.playbin, "uri", "https://gstreamer.freedesktop.org/data/media/sintel_trailer-480p.webm", NULL);

  /* 재생 시작 */ 
  ret = gst_element_set_state (data.playbin, GST_STATE_PLAYING);
  if (ret == GST_STATE_CHANGE_FAILURE) {
    g_printerr ("Unable to set the pipeline to the playing state.\n");
    gst_object_unref (data.playbin);
    return -1;
  }

  /* 버스 수신 시작 */ 
  bus = gst_element_get_bus (data.playbin);
  do {
    msg = gst_bus_timed_pop_filtered (bus, 100 * GST_MSECOND,
        GST_MESSAGE_STATE_CHANGED | GST_MESSAGE_ERROR | GST_MESSAGE_EOS | GST_MESSAGE_DURATION);

    /* 메시지 처리 */ 
    if (msg != NULL) {
      handle_message (&data, msg);
    } else {
      /* 메시지가 없으면 타임아웃 발생 */ 
      if (data.playing) {
        gint64 current = -1;

        /* 현재 스트림 위치 쿼리 */ 
        if (!gst_element_query_position (data.playbin, GST_FORMAT_TIME, &current)) {
          g_printerr ("Could not query current position.\n");
        }

        /* 전체 길이(duration) 쿼리 */ 
        if (!GST_CLOCK_TIME_IS_VALID (data.duration)) {
          if (!gst_element_query_duration (data.playbin, GST_FORMAT_TIME, &data.duration)) {
            g_printerr ("Could not query current duration.\n");
          }
        }

        /* 현재 위치 및 총 길이 출력 */ 
        g_print ("Position %" GST_TIME_FORMAT " / %" GST_TIME_FORMAT "\r",
            GST_TIME_ARGS (current), GST_TIME_ARGS (data.duration));

        /* 시킹 조건 만족 시 수행 */ 
        if (data.seek_enabled && !data.seek_done && current > 10 * GST_SECOND) {
          g_print ("\nReached 10s, performing seek...\n");
          gst_element_seek_simple (data.playbin, GST_FORMAT_TIME,
              GST_SEEK_FLAG_FLUSH | GST_SEEK_FLAG_KEY_UNIT, 30 * GST_SECOND);
          data.seek_done = TRUE;
        }
      }
    }
  } while (!data.terminate);

  /* 자원 해제 */ 
  gst_object_unref (bus);
  gst_element_set_state (data.playbin, GST_STATE_NULL);
  gst_object_unref (data.playbin);
  return 0;
}

// 메시지 처리 함수 
static void handle_message (CustomData *data, GstMessage *msg) {
  GError *err;
  gchar *debug_info;

  switch (GST_MESSAGE_TYPE (msg)) {
    case GST_MESSAGE_ERROR:
      gst_message_parse_error (msg, &err, &debug_info);
      g_printerr ("Error received from element %s: %s\n", GST_OBJECT_NAME (msg->src), err->message);
      g_printerr ("Debugging information: %s\n", debug_info ? debug_info : "none");
      g_clear_error (&err);
      g_free (debug_info);
      data->terminate = TRUE;
      break;
    case GST_MESSAGE_EOS:
      g_print ("\nEnd-Of-Stream reached.\n");
      data->terminate = TRUE;
      break;
    case GST_MESSAGE_DURATION:
      /* 길이 정보가 변경되었으므로 무효화 */ 
      data->duration = GST_CLOCK_TIME_NONE;
      break;
    case GST_MESSAGE_STATE_CHANGED: {
      GstState old_state, new_state, pending_state;
      gst_message_parse_state_changed (msg, &old_state, &new_state, &pending_state);
      if (GST_MESSAGE_SRC (msg) == GST_OBJECT (data->playbin)) {
        g_print ("Pipeline state changed from %s to %s:\n",
            gst_element_state_get_name (old_state), gst_element_state_get_name (new_state));

        /* 현재 PLAYING 상태인지 저장 */ 
        data->playing = (new_state == GST_STATE_PLAYING);

        if (data->playing) {
          /* PLAYING 상태로 진입했을 때, 시킹 가능한지 확인 */ 
          GstQuery *query;
          gint64 start, end;
          query = gst_query_new_seeking (GST_FORMAT_TIME);
          if (gst_element_query (data->playbin, query)) {
            gst_query_parse_seeking (query, NULL, &data->seek_enabled, &start, &end);
            if (data->seek_enabled) {
              g_print ("Seeking is ENABLED from %" GST_TIME_FORMAT " to %" GST_TIME_FORMAT "\n",
                  GST_TIME_ARGS (start), GST_TIME_ARGS (end));
            } else {
              g_print ("Seeking is DISABLED for this stream.\n");
            }
          }
          else {
            g_printerr ("Seeking query failed.");
          }
          gst_query_unref (query);
        }
      }
    } break;
    default:
      
      g_printerr ("Unexpected message received.\n");
      break;
  }
  gst_message_unref (msg);
}
```

## 2. 코드 분석

### 2.1 GStreamer 초기화

```c
/* 정보를 전달하기 위한 구조체 */ 
typedef struct _CustomData { 
  GstElement *playbin;      /* 하나뿐인 요소 */ 
  gboolean playing;         /* 현재 PLAYING 상태인지 */ 
  gboolean terminate;       /* 실행 종료 여부 */ 
  gboolean seek_enabled;    /* 시킹 기능 지원 여부 */ 
  gboolean seek_done;       /* 시킹 수행 여부 */ 
  gint64 duration;          /* 미디어 길이 (나노초 단위) */ 
} CustomData; 
 
/* 메시지 처리 함수 선언 */ 
static void handle_message (CustomData *data, GstMessage *msg); 
```

우선, 다양한 정보를 전달하기 위한 구조체를 정의합니다.
이 예제에서는 메시지 처리 코드가 커지기 때문에, 별도 함수인 `handle_message()`로 분리하였습니다.

### 2.2 파이프라인 생성

```c
  /* 요소 생성 */ 
  data.playbin = gst_element_factory_make ("playbin", "playbin");

  if (!data.playbin) {
    g_printerr ("Not all elements could be created.\n");
    return -1;
  }
```

그 다음, 단일 요소로 구성된 파이프라인을 생성합니다. 

이 요소는 playbin 이며, **기초 튜토리얼 1: Hello world!** 에서 이미 사용했던 바로 그 요소입니다.
하지만 **playbin** 자체가 하나의 전체 파이프라인을 포함한 고수준 요소이므로, 이번에는 별도의 구성 없이 **playbin** 만 단독으로 사용합니다.
**playbin** 에 URI 속성을 통해 재생할 미디어 주소를 지정하고, 파이프라인을 **PLAYING** 상태로 설정합니다.

### 2.3 타임 아웃 설정

```jsx
msg = gst_bus_timed_pop_filtered (bus, 100 * GST_MSECOND, 
    GST_MESSAGE_STATE_CHANGED | GST_MESSAGE_ERROR | GST_MESSAGE_EOS | GST_MESSAGE_DURATION); 
```

이전 튜토리얼에서는 `gst_bus_timed_pop_filtered()`에 타임아웃을 지정하지 않아, 메시지가 도착할 때까지 무한 대기했습니다.
이번에는 타임아웃을 100 밀리초로 설정했습니다.
즉, 0.1 초 동안 메시지가 없으면 NULL 을 반환하게 됩니다.
이 로직을 사용해, UI 를 주기적으로 업데이트하는 구조를 구현합니다.

### [#] 참고

 **GStreamer** 에서 시간은 `GstClockTime` 형식(나노초)으로 표현되며, 시간 단위 상수인 `GST_SECOND` 또는 `GST_MSECOND` 와 곱해줘야 합니다.
이 방식은 코드 가독성을 높여줍니다.

### 2.4. 사용자 인터페이스 갱신

```jsx
if (data.playing) { 
```

파이프라인이 **PLAYING** 상태일 때만 UI 를 갱신합니다.
그렇지 않으면 쿼리가 실패할 수 있기 때문입니다.
이 코드는 약 1 초에 10 번 정도 실행되며, 미디어 플레이어처럼 현재 재생 위치를 실시간으로 출력합니다.

### 2.4.1 Playing 상태일때 → 스트림의 현재 위치 Query

```jsx
/* 스트림의 현재 위치 쿼리 */ 
if (!gst_element_query_position (data.pipeline, GST_FORMAT_TIME, &current)) {
  g_printerr ("현재 위치를 쿼리할 수 없습니다.\n"); 
} 
```

`gst_element_query_position()` 함수는 쿼리 객체 생성 및 해제를 내부에서 처리하여 더 간편하게 현재 위치를 반환해 줍니다. 

### 2.4.2 Playing 상태일때 → 스트림 길이 Query

```jsx
/* 전체 길이 쿼리 */ 
if (!GST_CLOCK_TIME_IS_VALID (data.duration)) { 
  if (!gst_element_query_duration (data.pipeline, GST_FORMAT_TIME, &data.duration)) { 
    g_printerr ("전체 길이를 쿼리할 수 없습니다.\n"); 
  } 
} 
```

스트림의 길이를 알고 싶을 때는 `gst_element_query_duration()` 함수를 사용합니다.

이 역시 GStreamer 가 제공하는 간편 헬퍼 함수입니다.

### 2.4.3 Playing 상태일때 → 현재 위치와 전체 길이 출력

```jsx
/* 현재 위치와 전체 길이 출력 */ 
g_print ("위치 %" GST_TIME_FORMAT " / %" GST_TIME_FORMAT "\r", 
    GST_TIME_ARGS (current), GST_TIME_ARGS (data.duration)); 
```

`GST_TIME_FORMAT` 과 `GST_TIME_ARGS` 매크로는 `GStreamer`시간 정보를 사람이 읽을 수 있는
형식으로 출력해줍니다.

### 2.4.4 Playing 상태일때 → 시킹 조건 만족시, 시킹 수행

```jsx
/* 시킹 조건 만족 시, 시킹 수행 */ 
if (data.seek_enabled && !data.seek_done && current > 10 * GST_SECOND) { 
  g_print ("\n10초 도달, 시킹 수행...\n"); 
  gst_element_seek_simple (data.pipeline, GST_FORMAT_TIME, 
      GST_SEEK_FLAG_FLUSH | GST_SEEK_FLAG_KEY_UNIT, 30 * GST_SECOND); 
  data.seek_done = TRUE; 
} 
```

시킹 조건이 만족되면 `gst_element_seek_simple()`을 호출하여 30 초 위치로 점프합니다.
이 함수는 내부적으로 많은 복잡한 처리를 숨기고 있어 간단하게 시킹을 구현할 수 있습니다.

### 2.5. 메시지 처리 루프 (Message Pump)

`handle_message` 함수는 파이프라인의 버스를 통해 수신된 모든 메시지를 처리합니다. 

**ERROR** 와 **EOS(End Of Stream)** 처리는 이전 튜토리얼과 동일하므로, 흥미로운 부분으로 넘어갑니다:

### 2.5.1 스트림의 길이가 변경될 때

```jsx
case GST_MESSAGE_DURATION: 
/* 스트림의 길이가 변경되면 현재 길이를 무효로 표시 */ 
  data->duration = GST_CLOCK_TIME_NONE; 
  break; 
```

이 메시지는 스트림의 길이가 변경될 때 버스에 게시됩니다. 여기서는 단순히 현재 길이를
무효로 표시하여 나중에 다시 조회되도록 합니다.

### 2.5.2 GStreamer의 State가 변경 되었을때

시킹(**seeks**)과 시간 쿼리(**time queries**)는 일반적으로 **PAUSED** 또는 **PLAYING** 상태에서만 유효한
응답을 얻을 수 있습니다. 

이는 모든 요소들이 정보를 수신하고 설정을 마칠 기회를 얻기 때문입니다. 

여기에서는 `playing` 변수를 사용하여 파이프라인이 **PLAYING** 상태에 있는지 추적합니다.
또한, **PLAYING** 상태에 진입했을 때 처음으로 쿼리를 수행합니다. 

이 스트림에서 시킹이 가능한지 파이프라인에 질의합니다:

### 2.5.3 시킹(Seeking)이 가능한 경우

```jsx
if (data->playing) { 
  /* 방금 PLAYING 상태로 진입. 시킹 가능한지 확인 */ 
  GstQuery *query; 
  gint64 start, end; 
  query = gst_query_new_seeking (GST_FORMAT_TIME); 
  if (gst_element_query (data->pipeline, query)) { 
	    gst_query_parse_seeking (query, NULL, &data->seek_enabled, &start, &end); 
      if (data->seek_enabled) { 
		      g_print ("시킹 가능 범위: %" GST_TIME_FORMAT " ~ %" GST_TIME_FORMAT "\n", 
          GST_TIME_ARGS (start), GST_TIME_ARGS (end)); 
    } else { 
      g_print ("이 스트림은 시킹이 불가능합니다.\n"); 
    } 
  } 
  else { 
    g_printerr ("시킹 질의 실패.\n"); 
  } 
  gst_query_unref (query); 
} 
```

`gst_query_new_seeking()`은 **GST_FORMAT_TIME** 포맷을 사용하는 “**seeking**” 타입의 쿼리 객체를
생성합니다. 

이는 우리가 이동하고자 하는 시간을 지정하여 시킹하고자 함을 나타냅니다. 

`GST_FORMAT_BYTES` 를 사용할 수도 있으며, 이 경우 원본 파일 내의 특정 바이트 위치로 이동할 수 있지만 일반적으로는 덜 유용합니다.
이 쿼리 객체는 `gst_element_query()`를 통해 파이프라인에 전달되며, 결과는 동일한 객체에
저장됩니다.

 `gst_query_parse_seeking()`으로 이 결과를 쉽게 추출할 수 있습니다. 

이 함수는 시킹이 가능한지에 대한 불리언 값과 시킹 가능한 범위를 추출합니다. 
작업이 끝났으면 쿼리 객체를 반드시 unref 해야 합니다.

## 3. 컴파일 방법

```c
gcc basic-tutorial-4.c -o basic-tutorial-4 `pkg-config --cflags --libs gstreamer-1.0` 
```

## 4. 결과

이 튜토리얼은 윈도우를 열고 영상과 오디오를 함께 출력합니다.
미디어는 인터넷에서 스트리밍되므로, 연결 속도에 따라 창이 나타나기까지 약간의 시간이 소요될 수 있습니다.
영상이 시작되고 10 초가 지나면 지정된 새로운 위치로 점프(seek) 합니다.

### 4.1 ./basic-tutorial-4 실행 후 영상

![실행 직후 영상](https://github.com/user-attachments/assets/6cb1293b-17ae-443d-8f3e-377f6911ccb2)

### 4.2. 영상이 시작되고 10초가 지나서 새로운 위치로 점프(seek) 후 영상

![점프 후 영상](https://github.com/user-attachments/assets/36b45006-9eb0-43f0-b026-0fe38e5b4fb4)

## 5. 결론

이 튜토리얼에서 다룬 내용은 다음과 같습니다:

- **GstQuery** 를 사용해 파이프라인에서 정보를 질의하는 방법
- `gst_element_query_position()`과 `gst_element_query_duration()`을 사용해 위치와 길이 같은
일반 정보를 얻는 방법
- `gst_element_seek_simple()`을 사용해 스트림 내 임의의 위치로 시킹하는 방법
- 이러한 작업들이 어떤 상태에서 가능한지

다음 튜토리얼에서는 GStreamer 를 그래픽 사용자 인터페이스 툴킷과 통합하는 방법을 보여줍니다.
이 페이지에는 튜토리얼의 전체 소스 코드와 빌드에 필요한 보조 파일들이 첨부되어 있을 것입니다.

여기까지 함께해 주셔서 감사합니다. 또 만나요!