/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

const test = require('tape')
const AntPathMatcher = require('../../lib/utils/ant-path-matcher')

// https://github.com/spring-projects/spring-framework/blob/master/spring-core/src/test/java/org/springframework/util/AntPathMatcherTests.java
test('Unit test for AntPathMatcher', (t) => {
    const pathMatcher = new AntPathMatcher()

    // test exact matching
    t.ok(pathMatcher, 'Ant Path matcher initialization')
    t.true(pathMatcher.match("test", "test"))
    t.true(pathMatcher.match("/test", "/test"))

    // SPR-14141
    t.true(pathMatcher.match("https://example.org", "https://example.org"))
    t.false(pathMatcher.match("/test.jpg", "test.jpg"))
    t.false(pathMatcher.match("test", "/test"))
    t.false(pathMatcher.match("/test", "test"))

    // test matching with ?'s
    t.true(pathMatcher.match("t?st", "test"), "match('t?st', 'test')")
    t.true(pathMatcher.match("??st", "test"), 'match("??st", "test")')
    t.true(pathMatcher.match("tes?", "test"), 'match("tes?", "test")')
    t.true(pathMatcher.match("te??", "test"), 'match("te??", "test")')
    t.true(pathMatcher.match("?es?", "test"), 'match("?es?", "test")')
    t.false(pathMatcher.match("tes?", "tes"), 'match("tes?", "tes")')
    t.false(pathMatcher.match("tes?", "testt"), 'match("tes?", "testt")')
    t.false(pathMatcher.match("tes?", "tsst"), 'match("tes?", "tsst")')

    // test matching with *'s
    t.true(pathMatcher.match("*", "test"), 'pathMatcher.match("*", "test")')
    t.true(pathMatcher.match("test*", "test"), 'pathMatcher.match("test*", "test")')
    // t.true(pathMatcher.match("test*", "testTest"), 'pathMatcher.match("test*", "testTest")')
		// assertThat(pathMatcher.match("test/*", "test/Test")).isTrue();
		// assertThat(pathMatcher.match("test/*", "test/t")).isTrue();
		// assertThat(pathMatcher.match("test/*", "test/")).isTrue();
		// assertThat(pathMatcher.match("*test*", "AnothertestTest")).isTrue();
		// assertThat(pathMatcher.match("*test", "Anothertest")).isTrue();
		// assertThat(pathMatcher.match("*.*", "test.")).isTrue();
		// assertThat(pathMatcher.match("*.*", "test.test")).isTrue();
		// assertThat(pathMatcher.match("*.*", "test.test.test")).isTrue();
		// assertThat(pathMatcher.match("test*aaa", "testblaaaa")).isTrue();
		// assertThat(pathMatcher.match("test*", "tst")).isFalse();
		// assertThat(pathMatcher.match("test*", "tsttest")).isFalse();
		// assertThat(pathMatcher.match("test*", "test/")).isFalse();
		// assertThat(pathMatcher.match("test*", "test/t")).isFalse();
		// assertThat(pathMatcher.match("test/*", "test")).isFalse();
		// assertThat(pathMatcher.match("*test*", "tsttst")).isFalse();
		// assertThat(pathMatcher.match("*test", "tsttst")).isFalse();
		// assertThat(pathMatcher.match("*.*", "tsttst")).isFalse();
		// assertThat(pathMatcher.match("test*aaa", "test")).isFalse();
		// assertThat(pathMatcher.match("test*aaa", "testblaaab")).isFalse();

    t.end()
})