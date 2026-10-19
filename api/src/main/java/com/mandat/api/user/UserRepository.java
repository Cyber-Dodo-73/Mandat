package com.mandat.api.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Email and nickname are citext columns. JDBC binds strings as varchar, which would make Postgres
 * compare them as plain (case-sensitive) text, so those lookups cast the parameter to citext.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    @Query(value = "select * from users where email = cast(:email as citext)", nativeQuery = true)
    Optional<User> findByEmail(@Param("email") String email);

    @Query(value = "select exists(select 1 from users where email = cast(:email as citext))", nativeQuery = true)
    boolean existsByEmail(@Param("email") String email);

    @Query(value = "select exists(select 1 from users where nickname = cast(:nickname as citext))", nativeQuery = true)
    boolean existsByNickname(@Param("nickname") String nickname);

    Optional<User> findByAppleSub(String appleSub);

    Optional<User> findByGoogleSub(String googleSub);

    Optional<User> findByFriendCode(String friendCode);

    boolean existsByFriendCode(String friendCode);
}
