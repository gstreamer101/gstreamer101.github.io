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
