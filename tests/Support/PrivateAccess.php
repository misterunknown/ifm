<?php

namespace IFM\Tests\Support;

/**
 * Tiny helper to invoke private/protected methods and read private properties
 * via reflection. Used by the white-box unit tests for IFM's internal helpers.
 */
trait PrivateAccess
{
    protected function callPrivate(object $obj, string $method, array $args = [])
    {
        $ref = new \ReflectionMethod($obj, $method);
        return $ref->invokeArgs($obj, $args);
    }

    protected function getPrivate(object $obj, string $property)
    {
        $ref = new \ReflectionProperty($obj, $property);
        return $ref->getValue($obj);
    }
}
